use cache::Cache;
use std::sync::Arc;
use tokio::{sync::RwLock, task::JoinHandle};

use crate::{
    client::Client,
    model::{Account, AppConfig},
};
pub mod annual;
pub mod attendance;
pub mod basic;
pub mod cache;
mod constants;
pub mod jbox;
pub mod video;
pub mod video_library;
pub(crate) mod ppt;
#[cfg(test)]
mod ppt_audit;

pub struct App {
    client: Arc<Client>,
    current_account: RwLock<Account>,
    config: RwLock<AppConfig>,
    handle: RwLock<Option<JoinHandle<()>>>,
    mcp_handle: RwLock<Option<JoinHandle<()>>>,
    attendance_handle: RwLock<Option<JoinHandle<()>>>,
    attendance_status: RwLock<crate::model::AttendanceWatchStatus>,
    cache: Cache,
}

#[cfg(test)]
mod test {
    use crate::{
        error::Result,
        model::Account,
        App,
    };

    #[ignore = "requires a live Canvas token and network access"]
    #[tokio::test]
    async fn test_get_calendar_events() -> Result<()> {
        tracing_subscriber::fmt::init();
        let app = App::new();
        let courses = app.list_courses().await?;
        assert!(!courses.is_empty());
        let context_codes: Vec<_> = courses.iter().map(|course| format!("course_{}", course.id)).collect();
        let start_date = (chrono::Utc::now() - chrono::Duration::days(30))
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let end_date = (chrono::Utc::now() + chrono::Duration::days(30))
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let events = app
            .list_calendar_events(&context_codes, &start_date, &end_date)
            .await?;
        assert!(events.iter().all(|event| !event.context_code.is_empty()));
        Ok(())
    }

    #[ignore = "changes account files; set SJTU_CANVAS_TEST_CONFIG_DIR to an isolated directory"]
    #[tokio::test]
    async fn test_account() -> Result<()> {
        tracing_subscriber::fmt::init();
        let app = App::new();
        app.init().await?;

        let custom_account = Account::Custom("test".to_owned());
        let default_account = Account::Default;
        let non_existent_account = Account::Custom("Non-Existent".to_owned());
        let mut current_account = App::read_account_info()?;
        assert_eq!(current_account.all_accounts, vec![default_account.clone()]);
        assert_eq!(App::list_accounts()?, current_account.all_accounts);

        // Step 0: try to delete default account, should fail
        assert!(app.delete_account(&default_account).await.is_err());

        // Step 1: create account
        App::create_account(&custom_account)?;
        current_account = App::read_account_info()?;
        assert!(App::account_exists(&custom_account)?);
        assert_eq!(
            current_account.all_accounts,
            vec![default_account.clone(), custom_account.clone()]
        );
        assert_eq!(App::list_accounts()?, current_account.all_accounts);

        // cannot create duplicate accounts
        assert!(App::create_account(&custom_account).is_err());

        // Step 2: switch account
        app.switch_account(&custom_account).await?;
        current_account = App::read_account_info()?;
        assert_eq!(custom_account, current_account.current_account);
        assert_eq!(
            current_account.all_accounts,
            vec![default_account.clone(), custom_account.clone()]
        );
        assert_eq!(App::list_accounts()?, current_account.all_accounts);

        // Step 3 delete account
        app.delete_account(&custom_account).await?;
        current_account = App::read_account_info()?;
        assert!(!App::account_exists(&custom_account)?);
        assert_eq!(current_account.current_account, Default::default());
        assert_eq!(current_account.all_accounts, vec![default_account.clone()]);
        assert_eq!(App::list_accounts()?, current_account.all_accounts);

        // try to delete non-existent account should fail
        assert!(app.delete_account(&non_existent_account).await.is_err());
        Ok(())
    }

    #[ignore = "requires a live Canvas token and network access"]
    #[tokio::test]
    async fn test_filter_course_qrcode() -> Result<()> {
        tracing_subscriber::fmt::init();
        let app = App::new();
        app.init().await?;
        let course_id = app.list_courses().await?.first().expect("at least one course").id;
        let result = app.filter_course_qrcode_images(course_id).await?;
        tracing::info!("result: {:?}", result);
        Ok(())
    }

    #[ignore = "requires a valid jAccount cookie and an accessible legacy recording"]
    #[tokio::test]
    async fn test_video_apis() -> Result<()> {
        tracing_subscriber::fmt::init();
        let app = App::new();
        app.init().await?;
        app.login_video_website().await?;
        let courses = app.list_courses().await?;
        let mut first_video = None;
        for course in courses {
            let teachers: Vec<_> = course.teachers.iter().map(|teacher| teacher.display_name.clone()).collect();
            if let Ok(videos) = app.get_legacy_videos(course.id, &course.name, &course.term.name, &teachers).await {
                if let Some(video) = videos.into_iter().next() {
                    first_video = Some(video);
                    break;
                }
            }
        }
        let video = first_video.expect("no accessible legacy recording in the current courses");
        let video = app
            .get_video_play_info(crate::model::VideoSource::Legacy, &video.video_id)
            .await?;
        assert!(!video.video_play_response_vo_list.is_empty());
        Ok(())
    }

    #[ignore = "requires a valid jAccount cookie and an accessible Canvas recording"]
    #[tokio::test]
    async fn test_video_apis_with_canvas() -> Result<()> {
        tracing_subscriber::fmt::init();
        let app = App::new();
        app.init().await?;
        app.login_canvas_website().await?;
        let courses = app.list_courses().await?;
        let mut first_video = None;
        for course in courses {
            if let Ok(videos) = app.get_canvas_videos(course.id).await {
                if let Some(video) = videos.into_iter().next() {
                    first_video = Some(video);
                    break;
                }
            }
        }
        let video = first_video.expect("no accessible Canvas recording in the current courses");
        let video_info = app.get_canvas_video_info(&video.video_id).await?;
        assert!(!video_info.video_play_response_vo_list.is_empty());
        Ok(())
    }

    #[ignore = "requires a valid jAccount cookie and JBox access"]
    #[tokio::test]
    async fn test_jbox_apis() -> Result<()> {
        tracing_subscriber::fmt::init();
        let app = App::new();
        app.init().await?;
        app.login_jbox().await?;
        let info = app.get_config().await.jbox_login_info.clone();
        assert!(!info.library_id.is_empty());
        assert!(!info.space_id.is_empty());
        assert!(!info.access_token.is_empty());
        Ok(())
    }
}
