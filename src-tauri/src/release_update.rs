//! Updates distributed by this fork. These releases have no Tauri updater
//! signature, so the installer is downloaded from GitHub and its published
//! SHA-256 digest is checked before it is launched.

use futures::StreamExt;
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
#[cfg(target_os = "windows")]
use std::process::Command;
use std::{path::PathBuf, time::Duration};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

const REPO: &str = "Fancyyyf/SJTU-Canvas-Helper-fancy";
const MAX_INSTALLER_BYTES: u64 = 300 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize)]
struct ReleaseAsset {
    name: String,
    browser_download_url: String,
    digest: Option<String>,
    size: u64,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    assets: Vec<ReleaseAsset>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseUpdate {
    version: String,
    release_url: String,
    installer_available: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("SJTU-Canvas-Helper-fancy-updater")
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|error| format!("无法初始化更新网络连接：{error}"))
}

fn network_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "连接 GitHub 超时，请检查网络或代理后重试。".to_owned()
    } else if error.is_connect() {
        format!("无法连接 GitHub，请检查网络或代理后重试：{error}")
    } else {
        format!("访问 GitHub 失败：{error}")
    }
}

async fn latest_release(client: &reqwest::Client) -> Result<GithubRelease, String> {
    fetch_release(
        client,
        &format!("https://api.github.com/repos/{REPO}/releases/latest"),
    )
    .await
}

async fn fetch_release(client: &reqwest::Client, url: &str) -> Result<GithubRelease, String> {
    let response = client
        .get(url)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .timeout(Duration::from_secs(20))
        .send()
        .await
        .map_err(network_error)?;
    let status = response.status();
    if !status.is_success() {
        return Err(match status.as_u16() {
            403 | 429 => "GitHub 暂时限制了更新查询，请稍后重试。".to_owned(),
            404 => "更新源中没有已发布的正式版本。".to_owned(),
            _ => format!("GitHub 返回 HTTP {status}，无法检查更新。"),
        });
    }
    response
        .json::<GithubRelease>()
        .await
        .map_err(|error| format!("GitHub 的版本信息无效：{error}"))
}

fn release_version(tag: &str) -> Result<Version, String> {
    let value = tag
        .strip_prefix("app-v")
        .ok_or_else(|| format!("更新源返回了不支持的版本标签：{tag}"))?;
    Version::parse(value).map_err(|error| format!("更新源的版本号无效：{error}"))
}

#[cfg(target_os = "windows")]
fn installer_name(version: &Version) -> String {
    let arch = if cfg!(target_arch = "x86_64") {
        "x64"
    } else if cfg!(target_arch = "x86") {
        "x86"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "unsupported"
    };
    format!("SJTU.Canvas.Helper_{version}_{arch}-setup.exe")
}

#[cfg(not(target_os = "windows"))]
fn installer_name(_version: &Version) -> String {
    String::new()
}

fn installer_asset<'a>(release: &'a GithubRelease, version: &Version) -> Option<&'a ReleaseAsset> {
    let name = installer_name(version);
    release.assets.iter().find(|asset| asset.name == name)
}

#[tauri::command]
pub async fn check_release_update(app: AppHandle) -> Result<Option<ReleaseUpdate>, String> {
    let client = client()?;
    let release = latest_release(&client).await?;
    let version = release_version(&release.tag_name)?;
    let current = Version::parse(&app.package_info().version.to_string())
        .map_err(|error| format!("当前应用版本号无效：{error}"))?;
    if version <= current {
        return Ok(None);
    }
    Ok(Some(ReleaseUpdate {
        version: version.to_string(),
        release_url: release.html_url.clone(),
        installer_available: installer_asset(&release, &version).is_some(),
    }))
}

fn expected_digest(asset: &ReleaseAsset) -> Result<&str, String> {
    let digest = asset
        .digest
        .as_deref()
        .and_then(|value| value.strip_prefix("sha256:"))
        .ok_or("发布包缺少 SHA-256 校验值，已取消安装。")?;
    if digest.len() != 64 || !digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("发布包的 SHA-256 校验值无效，已取消安装。".to_owned());
    }
    Ok(digest)
}

async fn download_installer(
    app: &AppHandle,
    client: &reqwest::Client,
    asset: &ReleaseAsset,
    version: &Version,
) -> Result<PathBuf, String> {
    let digest = expected_digest(asset)?.to_owned();
    if asset.size == 0 || asset.size > MAX_INSTALLER_BYTES {
        return Err("发布包大小异常，已取消安装。".to_owned());
    }
    let directory = std::env::temp_dir()
        .join("sjtu-canvas-helper-updates")
        .join(version.to_string());
    tokio::fs::create_dir_all(&directory)
        .await
        .map_err(|error| format!("无法创建更新下载目录：{error}"))?;
    let target = directory.join(&asset.name);
    let partial = directory.join(format!("{}.{}.part", asset.name, std::process::id()));
    let response = client
        .get(&asset.browser_download_url)
        .send()
        .await
        .map_err(network_error)?;
    if !response.status().is_success() {
        return Err(format!("下载安装包失败：HTTP {}。", response.status()));
    }
    let mut file = tokio::fs::File::create(&partial)
        .await
        .map_err(|error| format!("无法写入更新下载文件：{error}"))?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0u64;
    let mut reported = 0u64;
    let result: Result<(), String> = async {
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(network_error)?;
            downloaded += chunk.len() as u64;
            if downloaded > asset.size || downloaded > MAX_INSTALLER_BYTES {
                return Err("下载大小超过发布包记录，已取消安装。".to_owned());
            }
            hasher.update(&chunk);
            file.write_all(&chunk)
                .await
                .map_err(|error| format!("写入安装包失败：{error}"))?;
            if downloaded.saturating_sub(reported) >= 1024 * 1024 {
                let _ = app.emit(
                    "release-update-progress",
                    DownloadProgress {
                        downloaded,
                        total: asset.size,
                    },
                );
                reported = downloaded;
            }
        }
        file.flush()
            .await
            .map_err(|error| format!("保存安装包失败：{error}"))?;
        if downloaded != asset.size {
            return Err(format!(
                "安装包下载不完整：收到 {downloaded} 字节，预期 {} 字节。",
                asset.size
            ));
        }
        let actual = format!("{:x}", hasher.finalize());
        if !actual.eq_ignore_ascii_case(&digest) {
            return Err("安装包 SHA-256 校验失败，已取消安装。".to_owned());
        }
        Ok(())
    }
    .await;
    drop(file);
    if let Err(error) = result {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(error);
    }
    if let Err(error) = tokio::fs::remove_file(&target).await {
        if error.kind() != std::io::ErrorKind::NotFound {
            let _ = tokio::fs::remove_file(&partial).await;
            return Err(format!("无法替换旧的安装包：{error}"));
        }
    }
    tokio::fs::rename(&partial, &target)
        .await
        .map_err(|error| format!("无法保存已校验的安装包：{error}"))?;
    let _ = app.emit(
        "release-update-progress",
        DownloadProgress {
            downloaded,
            total: asset.size,
        },
    );
    Ok(target)
}

#[tauri::command]
pub async fn install_release_update(
    app: AppHandle,
    expected_version: String,
) -> Result<(), String> {
    let client = client()?;
    let release = latest_release(&client).await?;
    let version = release_version(&release.tag_name)?;
    if version.to_string() != expected_version {
        return Err("下载期间发布了新版本，请重新检查更新。".to_owned());
    }
    let asset = installer_asset(&release, &version).ok_or_else(|| {
        format!(
            "v{version} 没有适用于当前系统的自动安装包，请从 {} 手动下载。",
            release.html_url
        )
    })?;
    let path = download_installer(&app, &client, asset, &version).await?;
    #[cfg(target_os = "windows")]
    {
        Command::new(&path)
            .spawn()
            .map_err(|error| format!("安装包已下载至 {}，但无法启动：{error}", path.display()))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("当前系统暂不支持应用内启动安装包，请从 GitHub Release 手动下载。".to_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unrelated_release_tags() {
        assert_eq!(
            release_version("app-v3.0.16").unwrap(),
            Version::new(3, 0, 16)
        );
        assert!(release_version("v3.0.16").is_err());
    }

    #[test]
    fn requires_a_valid_sha256_digest() {
        let mut asset = ReleaseAsset {
            name: String::new(),
            browser_download_url: String::new(),
            digest: Some(format!("sha256:{}", "a".repeat(64))),
            size: 1,
        };
        assert!(expected_digest(&asset).is_ok());
        asset.digest = Some("sha256:invalid".to_owned());
        assert!(expected_digest(&asset).is_err());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn selects_the_windows_installer_instead_of_the_portable_binary() {
        let version = Version::new(3, 0, 16);
        let expected = installer_name(&version);
        let release = GithubRelease {
            tag_name: "app-v3.0.16".to_owned(),
            html_url: String::new(),
            assets: ["SJTU.Canvas.Helper_3.0.16.exe", &expected]
                .into_iter()
                .map(|name| ReleaseAsset {
                    name: name.to_owned(),
                    browser_download_url: String::new(),
                    digest: None,
                    size: 1,
                })
                .collect(),
        };
        assert_eq!(installer_asset(&release, &version).unwrap().name, expected);
    }

    #[tokio::test]
    async fn reports_github_http_and_response_errors() {
        use httpmock::prelude::*;
        let server = MockServer::start();
        let rate_limit = server.mock(|when, then| {
            when.path("/rate-limit");
            then.status(403);
        });
        let invalid_json = server.mock(|when, then| {
            when.path("/invalid-json");
            then.status(200).body("not json");
        });
        let client = client().unwrap();
        let error = fetch_release(&client, &server.url("/rate-limit"))
            .await
            .unwrap_err();
        assert!(error.contains("限制"));
        rate_limit.assert();
        let error = fetch_release(&client, &server.url("/invalid-json"))
            .await
            .unwrap_err();
        assert!(error.contains("版本信息无效"));
        invalid_json.assert();
    }
}
