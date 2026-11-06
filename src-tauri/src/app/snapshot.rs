use std::time::Duration;

use serde_json::{json, Value};

use crate::{
    error::Result,
    model::{Assignment, File},
};

use super::cache::DiskCache;
use super::App;

pub(crate) fn project_file(item: &File) -> Value {
    json!({
        "id": item.id, "folderId": item.folder_id, "name": item.display_name,
        "size": item.size, "contentType": item.content_type, "updatedAt": item.updated_at,
    })
}

pub(crate) fn project_assignment(item: &Assignment) -> Value {
    json!({
        "id": item.id, "courseId": item.course_id, "name": item.name,
        "dueAt": item.due_at, "published": item.published,
        "hasSubmittedSubmissions": item.has_submitted_submissions,
    })
}

impl App {
    pub async fn snapshot_assignments(&self, course_id: i64) -> Result<Vec<Value>> {
        let key = self.metadata_cache_key("safe-assignments", course_id).await;
        if let Some(items) = self.cache.get(&key)? {
            return Ok(items);
        }
        let token = self.config.read().await.token.clone();
        let disk = DiskCache::new(std::path::Path::new(&Self::config_dir()?));
        if let Some(items) = disk.get::<Vec<Value>>(&key, &token) {
            self.cache
                .set_with_ttl(key, items.clone(), Duration::from_secs(5 * 60))?;
            return Ok(items);
        }
        let items = self
            .list_course_assignments(course_id)
            .await?
            .iter()
            .map(project_assignment)
            .collect::<Vec<_>>();
        self.cache
            .set_with_ttl(key.clone(), items.clone(), Duration::from_secs(5 * 60))?;
        if let Err(error) = disk.set(&key, &token, &items, Duration::from_secs(5 * 60)) {
            tracing::warn!(error = %error, "Could not persist safe assignment metadata");
        }
        Ok(items)
    }

    pub async fn snapshot_files(&self, course_id: i64) -> Result<Vec<Value>> {
        let key = self.metadata_cache_key("safe-files", course_id).await;
        if let Some(items) = self.cache.get(&key)? {
            return Ok(items);
        }
        let token = self.config.read().await.token.clone();
        let disk = DiskCache::new(std::path::Path::new(&Self::config_dir()?));
        if let Some(items) = disk.get::<Vec<Value>>(&key, &token) {
            self.cache
                .set_with_ttl(key, items.clone(), Duration::from_secs(60 * 60))?;
            return Ok(items);
        }
        let items = self
            .list_course_files(course_id)
            .await?
            .iter()
            .map(project_file)
            .collect::<Vec<_>>();
        self.cache
            .set_with_ttl(key.clone(), items.clone(), Duration::from_secs(60 * 60))?;
        if let Err(error) = disk.set(&key, &token, &items, Duration::from_secs(60 * 60)) {
            tracing::warn!(error = %error, "Could not persist safe file metadata");
        }
        Ok(items)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn projections_omit_signed_urls() {
        let file = File {
            url: "https://example.test/a?token=secret".into(),
            preview_url: Some("https://example.test/preview?key=secret".into()),
            ..Default::default()
        };
        let assignment = Assignment {
            submissions_download_url: "https://example.test/submissions?key=secret".into(),
            ..Default::default()
        };
        assert!(!project_file(&file).to_string().contains("secret"));
        assert!(!project_assignment(&assignment)
            .to_string()
            .contains("secret"));
    }
}
