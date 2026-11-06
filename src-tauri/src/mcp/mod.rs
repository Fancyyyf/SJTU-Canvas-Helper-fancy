use axum::{Router, extract::{Request, State}, http::{StatusCode, header::{HOST, ORIGIN}}, middleware::{self, Next}, response::{IntoResponse, Json, Response}};
use rmcp::{
    ErrorData, ServerHandler,
    handler::server::wrapper::Parameters,
    model::*,
    tool, tool_handler, tool_router,
    transport::streamable_http_server::{
        StreamableHttpServerConfig, StreamableHttpService,
        session::local::LocalSessionManager,
    },
};
use serde_json::{json, Value, Map};
use tokio_util::sync::CancellationToken;

use serde::Serialize;
use std::net::SocketAddr;

use crate::{model::File, APP};

fn local_authority(value: &str, port: u16) -> bool {
    value.eq_ignore_ascii_case(&format!("127.0.0.1:{port}"))
        || value.eq_ignore_ascii_case(&format!("localhost:{port}"))
}

fn allowed_origin(value: &str, port: u16) -> bool {
    let Ok(origin) = tauri::Url::parse(value) else { return false; };
    if !matches!(origin.path(), "" | "/") || origin.query().is_some() || origin.fragment().is_some() { return false; }
    let host = origin.host_str().unwrap_or_default();
    match origin.scheme() {
        "http" => (host == "localhost" || host == "127.0.0.1") && origin.port() == Some(port)
            || host == "tauri.localhost" && origin.port().is_none(),
        "https" => host == "tauri.localhost" && origin.port().is_none(),
        "tauri" => host == "localhost" && origin.port().is_none(),
        _ => false,
    }
}

async fn local_request_only(State(port): State<u16>, request: Request, next: Next) -> Response {
    let headers = request.headers();
    let host_allowed = headers.get(HOST).and_then(|value| value.to_str().ok()).is_some_and(|value| local_authority(value, port));
    let origin_allowed = headers.get(ORIGIN).map(|value| value.to_str().ok().is_some_and(|value| allowed_origin(value, port))).unwrap_or(true);
    if !host_allowed || !origin_allowed { return StatusCode::FORBIDDEN.into_response(); }
    next.run(request).await
}

#[derive(Clone)]
struct McpServer;

fn internal(e: crate::error::AppError) -> ErrorData {
    ErrorData::internal_error(
        crate::diagnostics::sanitize_text(&e.to_string()),
        Some(json!({"code": e.code()})),
    )
}

fn invalid(e: impl ToString) -> ErrorData {
    ErrorData::invalid_params(e.to_string(), None)
}

fn get_i64(params: &Map<String, Value>, key: &str) -> Result<i64, ErrorData> {
    params
        .get(key)
        .and_then(|v| v.as_i64())
        .ok_or_else(|| invalid(format!("Missing or invalid {key}")))
}

fn get_string(params: &Map<String, Value>, key: &str) -> Result<String, ErrorData> {
    params
        .get(key)
        .and_then(|v| v.as_str().map(String::from))
        .ok_or_else(|| invalid(format!("Missing or invalid {key}")))
}

fn get_vec<T>(params: &Map<String, Value>, key: &str) -> Result<Vec<T>, ErrorData>
where
    T: serde::de::DeserializeOwned,
{
    params
        .get(key)
        .map(|v| serde_json::from_value::<Vec<T>>(v.clone()))
        .transpose()
        .map_err(|e| invalid(e.to_string()))?
        .ok_or_else(|| invalid(format!("Missing or invalid {key}")))
}

fn tool_json(data: impl Serialize) -> CallToolResult {
    CallToolResult::success(vec![Content::text(
        serde_json::to_string_pretty(&data).unwrap_or_default(),
    )])
}

#[tool_router]
impl McpServer {
    #[tool(description = "List all courses for the current Canvas user")]
    async fn list_courses(&self) -> Result<CallToolResult, ErrorData> {
        APP.list_courses().await.map(tool_json).map_err(internal)
    }

    #[tool(description = "Read a bounded course snapshot with assignment and file metadata; signed download URLs are excluded")]
    async fn course_snapshot(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        let limit = params.get("limit").and_then(Value::as_u64).unwrap_or(50);
        if !(1..=100).contains(&limit) { return Err(invalid("limit must be between 1 and 100")); }
        let offset = params.get("offset").and_then(Value::as_u64).unwrap_or(0);
        if offset > 10_000 { return Err(invalid("offset must be at most 10000")); }
        let course = APP.list_courses().await.map_err(internal)?.into_iter()
            .find(|course| course.id == course_id)
            .ok_or_else(|| invalid("course_id is not in the current account"))?;
        let (assignments, files) = tokio::join!(APP.snapshot_assignments(course_id), APP.snapshot_files(course_id));
        let mut errors = Vec::new();
        let assignments = match assignments {
            Ok(items) => items,
            Err(error) => { errors.push(json!({"resource": "assignments", "code": error.code()})); Vec::new() },
        };
        let files = match files {
            Ok(items) => items,
            Err(error) => { errors.push(json!({"resource": "files", "code": error.code()})); Vec::new() },
        };
        let assignment_count = assignments.len();
        let file_count = files.len();
        Ok(tool_json(json!({
            "course": {"id": course.id, "name": course.name, "courseCode": course.course_code, "term": {"id": course.term.id, "name": course.term.name}},
            "assignments": assignments.into_iter().skip(offset as usize).take(limit as usize).collect::<Vec<_>>(),
            "files": files.into_iter().skip(offset as usize).take(limit as usize).collect::<Vec<_>>(),
            "counts": {"assignments": assignment_count, "files": file_count},
            "truncated": assignment_count > (offset + limit) as usize || file_count > (offset + limit) as usize,
            "offset": offset, "limit": limit,
            "partialErrors": errors,
            "generatedAt": chrono::Utc::now().to_rfc3339(),
            "cacheTtlSeconds": {"courses": 86400, "assignments": 300, "files": 3600}
        })))
    }

    #[tool(description = "Get the current user's profile information")]
    async fn get_me(&self) -> Result<CallToolResult, ErrorData> {
        APP.get_me().await.map(tool_json).map_err(internal)
    }

    #[tool(description = "List all assignments for a specific course")]
    async fn list_course_assignments(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        APP.list_course_assignments(course_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List all files in a course")]
    async fn list_course_files(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        APP.list_course_files(course_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List all folders in a course")]
    async fn list_course_folders(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        APP.list_course_folders(course_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List all users enrolled in a course")]
    async fn list_course_users(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        APP.list_course_users(course_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List all students enrolled in a course")]
    async fn list_course_students(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        APP.list_course_students(course_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List all files in a specific folder by folder ID")]
    async fn list_folder_files(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let folder_id = get_i64(&params, "folder_id")?;
        APP.list_folder_files(folder_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List all subfolders in a specific folder")]
    async fn list_folder_folders(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let folder_id = get_i64(&params, "folder_id")?;
        APP.list_folder_folders(folder_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List the current user's personal folders")]
    async fn list_my_folders(&self) -> Result<CallToolResult, ErrorData> {
        APP.list_my_folders()
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "Get folder details by folder ID")]
    async fn get_folder_by_id(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let folder_id = get_i64(&params, "folder_id")?;
        APP.get_folder_by_id(folder_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "Get course color assignments for the user's dashboard")]
    async fn get_colors(&self) -> Result<CallToolResult, ErrorData> {
        APP.get_colors().await.map(tool_json).map_err(internal)
    }

    #[tool(description = "List calendar events for specified courses within a date range")]
    async fn list_calendar_events(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let context_codes: Vec<String> = get_vec(&params, "context_codes")?;
        let start_date = get_string(&params, "start_date")?;
        let end_date = get_string(&params, "end_date")?;
        APP.list_calendar_events(&context_codes, &start_date, &end_date)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List all discussion topics for a course")]
    async fn list_discussion_topics(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        APP.list_discussion_topics(course_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "Get the full discussion including all replies for a topic")]
    async fn get_full_discussion(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        let topic_id = get_i64(&params, "topic_id")?;
        APP.get_full_discussion(course_id, topic_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List all image files in a course")]
    async fn list_course_images(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        APP.list_course_images(course_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "Get the current user's submission for a specific assignment")]
    async fn get_my_single_submission(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        let assignment_id = get_i64(&params, "assignment_id")?;
        APP.get_my_single_submission(course_id, assignment_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List all submissions for a specific assignment in a course")]
    async fn list_course_assignment_submissions(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        let assignment_id = get_i64(&params, "assignment_id")?;
        APP.list_course_assignment_submissions(course_id, assignment_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "Get a specific student's submission for an assignment")]
    async fn get_single_course_assignment_submission(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        let assignment_id = get_i64(&params, "assignment_id")?;
        let student_id = get_i64(&params, "student_id")?;
        APP.get_single_course_assignment_submission(course_id, assignment_id, student_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List submissions for specific students across all assignments in a course")]
    async fn list_user_submissions(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        let student_ids: Vec<i64> = get_vec(&params, "student_ids")?;
        APP.list_user_submissions(course_id, &student_ids)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "List external URL module items in a course")]
    async fn list_external_module_items(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let course_id = get_i64(&params, "course_id")?;
        APP.list_external_module_items(course_id)
            .await
            .map(tool_json)
            .map_err(internal)
    }

    #[tool(description = "Send a prompt to the configured LLM and get a response")]
    async fn chat(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let prompt = get_string(&params, "prompt")?;
        let response = APP.chat(prompt).await.map_err(internal)?;
        Ok(tool_json(json!({ "response": response })))
    }

    #[tool(description = "Get an AI explanation of a file's content")]
    async fn explain_file(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let file: File = params
            .get("file")
            .map(|v| serde_json::from_value(v.clone()))
            .transpose()
            .map_err(|e| invalid(e.to_string()))?
            .ok_or_else(|| invalid("Missing file"))?;
        let explanation = APP.explain_file(&file).await.map_err(internal)?;
        Ok(tool_json(json!({ "explanation": explanation })))
    }

    #[tool(description = "Test if a Canvas API token is valid and return the associated user")]
    async fn test_token(
        &self,
        Parameters(params): Parameters<Map<String, Value>>,
    ) -> Result<CallToolResult, ErrorData> {
        let token = get_string(&params, "token")?;
        APP.test_token(&token)
            .await
            .map(tool_json)
            .map_err(internal)
    }
}

#[tool_handler]
impl ServerHandler for McpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(
            ServerCapabilities::builder().enable_tools().build(),
        )
        .with_server_info(Implementation::from_build_env())
        .with_protocol_version(ProtocolVersion::V_2024_11_05)
        .with_instructions(
            "Canvas course management assistant. Use list_courses to browse courses, \
            list_course_assignments/files/folders/users/students for course details, \
            and get_my_single_submission to check your own submissions."
                .to_string(),
        )
    }
}

pub fn start_mcp_server(port: u16) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let ct = CancellationToken::new();

        let service = StreamableHttpService::new(
            || Ok(McpServer),
            LocalSessionManager::default().into(),
            StreamableHttpServerConfig::default()
                .with_sse_keep_alive(Some(std::time::Duration::from_secs(15)))
                .with_stateful_mode(true)
                .with_cancellation_token(ct.child_token()),
        );

        let router = Router::new()
            .route(
                "/health",
                axum::routing::get(|| async { Json(json!({"status": "ok"})) }),
            )
            .fallback_service(service)
            .layer(middleware::from_fn_with_state(port, local_request_only));

        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        let listener = tokio::net::TcpListener::bind(addr)
            .await
            .expect("Failed to bind MCP server address");

        tracing::info!("MCP SSE server started on port {port}");

        axum::serve(listener, router)
            .with_graceful_shutdown(async move { ct.cancelled().await; })
            .await
            .expect("MCP server failed");
    })
}

#[cfg(test)]
mod local_access_tests {
    use super::{allowed_origin, local_authority};

    #[test]
    fn rejects_remote_host_and_browser_origin() {
        assert!(local_authority("localhost:3100", 3100));
        assert!(local_authority("127.0.0.1:3100", 3100));
        assert!(!local_authority("evil.example:3100", 3100));
        assert!(!local_authority("localhost:3100.evil.example", 3100));
        assert!(allowed_origin("tauri://localhost", 3100));
        assert!(allowed_origin("http://localhost:3100", 3100));
        assert!(!allowed_origin("https://evil.example", 3100));
        assert!(!allowed_origin("http://localhost:3100.evil.example", 3100));
    }

}
