use std::{collections::HashMap, fs, io::Write, path::Path};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    model::{Account, AppConfig, File, LlmApiKeyEntry},
};

const SERVICE: &str = "SJTU-Canvas-Helper.credentials.v1";
const CHUNK_BYTES: usize = 1800;

pub(crate) trait CredentialStore {
    fn put(&self, name: &str, value: &str) -> Result<()>;
    fn get(&self, name: &str) -> Result<String>;
    fn delete(&self, name: &str) -> Result<()>;
}

pub(crate) struct OsCredentialStore;

impl CredentialStore for OsCredentialStore {
    fn put(&self, name: &str, value: &str) -> Result<()> {
        keyring::Entry::new(SERVICE, name)
            .and_then(|entry| entry.set_password(value))
            .map_err(|_| AppError::CredentialStore("系统凭据库写入失败".into()))
    }
    fn get(&self, name: &str) -> Result<String> {
        keyring::Entry::new(SERVICE, name)
            .and_then(|entry| entry.get_password())
            .map_err(|error| match error {
                keyring::Error::NoEntry => {
                    AppError::CredentialMissing("系统凭据条目缺失，请重新登录".into())
                }
                _ => AppError::CredentialStore("系统凭据库暂时不可用，请恢复后重试读取".into()),
            })
    }
    fn delete(&self, name: &str) -> Result<()> {
        keyring::Entry::new(SERVICE, name)
            .and_then(|entry| entry.delete_credential())
            .map_err(|_| AppError::CredentialStore("系统凭据库删除失败".into()))
    }
}

#[derive(Default, Clone, Serialize, Deserialize, PartialEq, Debug)]
#[serde(default)]
struct Secrets {
    token: String,
    ja_auth_cookie: String,
    video_cookies: String,
    attendance_password: String,
    llm_api_key: String,
    llm_api_keys: Vec<LlmApiKeyEntry>,
    oauth_consumer_key: String,
    jbox_access_token: String,
    course_assignment_file_bindings: HashMap<i64, Vec<File>>,
}

impl Secrets {
    fn take(config: &mut AppConfig) -> Self {
        Self {
            token: std::mem::take(&mut config.token),
            ja_auth_cookie: std::mem::take(&mut config.ja_auth_cookie),
            video_cookies: std::mem::take(&mut config.video_cookies),
            attendance_password: std::mem::take(&mut config.attendance_password),
            llm_api_key: std::mem::take(&mut config.llm_api_key),
            llm_api_keys: std::mem::take(&mut config.llm_api_keys),
            oauth_consumer_key: std::mem::take(&mut config.oauth_consumer_key),
            jbox_access_token: std::mem::take(&mut config.jbox_login_info.access_token),
            course_assignment_file_bindings: std::mem::take(
                &mut config.course_assignment_file_bindings,
            ),
        }
    }

    fn apply(self, config: &mut AppConfig) {
        config.token = self.token;
        config.ja_auth_cookie = self.ja_auth_cookie;
        config.video_cookies = self.video_cookies;
        config.attendance_password = self.attendance_password;
        config.llm_api_key = self.llm_api_key;
        config.llm_api_keys = self.llm_api_keys;
        config.oauth_consumer_key = self.oauth_consumer_key;
        config.jbox_login_info.access_token = self.jbox_access_token;
        config.course_assignment_file_bindings = self.course_assignment_file_bindings;
    }

    fn empty(&self) -> bool {
        self.token.is_empty()
            && self.ja_auth_cookie.is_empty()
            && self.video_cookies.is_empty()
            && self.attendance_password.is_empty()
            && self.llm_api_key.is_empty()
            && self.llm_api_keys.is_empty()
            && self.oauth_consumer_key.is_empty()
            && self.jbox_access_token.is_empty()
            && self.course_assignment_file_bindings.is_empty()
    }
}

fn scope(path: &Path, account: &Account, config: &AppConfig) -> String {
    let mut digest = Sha256::new();
    digest.update(path.to_string_lossy().as_bytes());
    digest.update(serde_json::to_vec(account).unwrap_or_default());
    digest.update(serde_json::to_vec(&config.account_type).unwrap_or_default());
    format!("{:x}", digest.finalize())
}

fn chunk_name(reference: &str, index: usize) -> String {
    format!("{reference}.{index}")
}

fn chunks(value: &str) -> Vec<&str> {
    let mut result = Vec::new();
    let mut start = 0;
    while start < value.len() {
        let mut end = (start + CHUNK_BYTES).min(value.len());
        while !value.is_char_boundary(end) {
            end -= 1;
        }
        result.push(&value[start..end]);
        start = end;
    }
    result
}

fn read_secret(config: &AppConfig, store: &impl CredentialStore) -> Result<Secrets> {
    if config.credential_ref.is_empty()
        || config.credential_chunks == 0
        || config.credential_chunks > 1024
    {
        return Err(AppError::CredentialMissing("凭据引用格式无效".into()));
    }
    let mut content = String::new();
    for index in 0..config.credential_chunks {
        content.push_str(&store.get(&chunk_name(&config.credential_ref, index))?);
    }
    serde_json::from_str(&content).map_err(|_| AppError::CredentialMissing("凭据内容损坏".into()))
}

fn remove_old(config: &AppConfig, store: &impl CredentialStore) {
    for index in 0..config.credential_chunks.min(1024) {
        if let Err(error) = store.delete(&chunk_name(&config.credential_ref, index)) {
            tracing::warn!(error = %error, "Could not remove obsolete credential chunk");
        }
    }
}

fn atomic_config(path: &Path, config: &AppConfig) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::CredentialStore("配置目录无效".into()))?;
    let temporary = parent.join(format!(".config-{}.tmp", Uuid::new_v4()));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(&serde_json::to_vec(config)?)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

pub(crate) fn load(
    path: &Path,
    account: &Account,
    store: &impl CredentialStore,
) -> Result<AppConfig> {
    let content = fs::read(path)?;
    let mut config: AppConfig = serde_json::from_slice(&content)?;
    if config.credential_ref.is_empty() && config.credential_version == 0 {
        // Legacy files are migrated only after every secret has been verified in the OS store.
        save(path, account, &config, store)?;
    } else if config.credential_ref.is_empty() {
        let mut check = config.clone();
        if !Secrets::take(&mut check).empty() {
            return Err(AppError::CredentialStore("配置版本与凭据内容不一致".into()));
        }
    } else {
        let mut check = config.clone();
        if !Secrets::take(&mut check).empty() {
            return Err(AppError::CredentialStore("迁移后配置仍含明文凭据".into()));
        }
        if !config
            .credential_ref
            .starts_with(&format!("{}-", scope(path, account, &config)))
        {
            return Err(AppError::CredentialMissing("凭据引用与账号不匹配".into()));
        }
        read_secret(&config, store)?.apply(&mut config);
    }
    Ok(config)
}

pub(crate) fn load_without_secrets(path: &Path) -> Result<AppConfig> {
    let mut config: AppConfig = serde_json::from_slice(&fs::read(path)?)?;
    Secrets::take(&mut config);
    Ok(config)
}

pub(crate) fn same_secrets(first: &AppConfig, second: &AppConfig) -> bool {
    let mut first = first.clone();
    let mut second = second.clone();
    Secrets::take(&mut first) == Secrets::take(&mut second)
}

pub(crate) fn save(
    path: &Path,
    account: &Account,
    config: &AppConfig,
    store: &impl CredentialStore,
) -> Result<()> {
    let previous = match fs::read(path) {
        Ok(bytes) => Some(serde_json::from_slice::<AppConfig>(&bytes)?),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.into()),
    };
    if let Some(previous) = &previous {
        if !previous.credential_ref.is_empty() {
            if !previous
                .credential_ref
                .starts_with(&format!("{}-", scope(path, account, previous)))
            {
                return Err(AppError::CredentialMissing("凭据引用与账号不匹配".into()));
            }
            read_secret(previous, store)?;
        }
    }
    let mut public = config.clone();
    let secret = Secrets::take(&mut public);
    public.credential_ref.clear();
    public.credential_chunks = 0;
    public.credential_version = 1;
    let mut written: Vec<String> = Vec::new();
    if !secret.empty() {
        let reference = format!("{}-{}", scope(path, account, config), Uuid::new_v4());
        let serialized = serde_json::to_string(&secret)?;
        for (index, chunk) in chunks(&serialized).iter().enumerate() {
            let name = chunk_name(&reference, index);
            if let Err(error) = store.put(&name, chunk) {
                for name in written {
                    let _ = store.delete(&name);
                }
                return Err(error);
            }
            written.push(name);
        }
        public.credential_ref = reference;
        public.credential_chunks = written.len();
        let verified = read_secret(&public, store);
        if !matches!(verified, Ok(ref stored) if stored == &secret) {
            for name in written {
                let _ = store.delete(&name);
            }
            return Err(AppError::CredentialStore("凭据写入校验失败".into()));
        }
    }
    if let Err(error) = atomic_config(path, &public) {
        for name in written {
            let _ = store.delete(&name);
        }
        return Err(error);
    }
    if let Some(previous) = previous {
        remove_old(&previous, store);
    }
    Ok(())
}

pub(crate) fn delete(path: &Path, store: &impl CredentialStore) -> Result<()> {
    let config: AppConfig = serde_json::from_slice(&fs::read(path)?)?;
    fs::remove_file(path)?;
    remove_old(&config, store);
    Ok(())
}

/// Explicit recovery path when the OS credential entry is permanently unavailable.
/// The old keyring reference is not deleted, so an OS-level recovery remains possible.
pub(crate) fn forget(path: &Path) -> Result<()> {
    let mut config = load_without_secrets(path)?;
    config.credential_ref.clear();
    config.credential_chunks = 0;
    config.credential_version = 1;
    atomic_config(path, &config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, sync::Mutex};
    #[derive(Default)]
    struct Mock(Mutex<HashMap<String, String>>);
    impl CredentialStore for Mock {
        fn put(&self, n: &str, v: &str) -> Result<()> {
            self.0.lock().unwrap().insert(n.into(), v.into());
            Ok(())
        }
        fn get(&self, n: &str) -> Result<String> {
            self.0
                .lock()
                .unwrap()
                .get(n)
                .cloned()
                .ok_or_else(|| AppError::CredentialStore("missing".into()))
        }
        fn delete(&self, n: &str) -> Result<()> {
            self.0.lock().unwrap().remove(n);
            Ok(())
        }
    }
    #[test]
    fn migration_and_repeat_load() -> Result<()> {
        let path = std::env::temp_dir().join(format!("credential-test-{}.json", Uuid::new_v4()));
        let account = Account::Default;
        let store = Mock::default();
        let original = AppConfig {
            token: "private-token".into(),
            attendance_password: "password".into(),
            course_assignment_file_bindings: HashMap::from([(
                1,
                vec![File {
                    url: "https://example.test?token=signed-url-secret".into(),
                    ..Default::default()
                }],
            )]),
            ..Default::default()
        };
        fs::write(&path, serde_json::to_vec(&original)?)?;
        assert_eq!(load(&path, &account, &store)?.token, "private-token");
        assert!(!fs::read_to_string(&path)?.contains("private-token"));
        assert!(!fs::read_to_string(&path)?.contains("signed-url-secret"));
        assert_eq!(
            load(&path, &account, &store)?.attendance_password,
            "password"
        );
        fs::remove_file(path)?;
        Ok(())
    }

    #[test]
    fn failed_migration_keeps_original_file_and_recovery_is_explicit() -> Result<()> {
        struct Failing;
        impl CredentialStore for Failing {
            fn put(&self, _: &str, _: &str) -> Result<()> {
                Err(AppError::CredentialStore("simulated failure".into()))
            }
            fn get(&self, _: &str) -> Result<String> {
                Err(AppError::CredentialStore("missing".into()))
            }
            fn delete(&self, _: &str) -> Result<()> {
                Ok(())
            }
        }
        let path = std::env::temp_dir().join(format!("credential-test-{}.json", Uuid::new_v4()));
        let legacy = AppConfig {
            token: "legacy-token".into(),
            ..Default::default()
        };
        let original = serde_json::to_vec(&legacy)?;
        fs::write(&path, &original)?;
        assert!(load(&path, &Account::Default, &Failing).is_err());
        assert_eq!(fs::read(&path)?, original);
        struct Corrupt;
        impl CredentialStore for Corrupt {
            fn put(&self, _: &str, _: &str) -> Result<()> {
                Ok(())
            }
            fn get(&self, _: &str) -> Result<String> {
                Ok("wrong-data".into())
            }
            fn delete(&self, _: &str) -> Result<()> {
                Ok(())
            }
        }
        assert!(load(&path, &Account::Default, &Corrupt).is_err());
        assert_eq!(fs::read(&path)?, original);
        forget(&path)?;
        assert_eq!(load(&path, &Account::Default, &Failing)?.token, "");
        fs::remove_file(path)?;
        Ok(())
    }

    #[test]
    fn large_credentials_are_chunked_and_account_scoped() -> Result<()> {
        let root = std::env::temp_dir().join(format!("credential-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root)?;
        let store = Mock::default();
        let first = root.join("first.json");
        let second = root.join("second.json");
        let config = AppConfig {
            token: "secret".repeat(2000),
            ..Default::default()
        };
        save(&first, &Account::Default, &config, &store)?;
        save(&second, &Account::Custom("B".into()), &config, &store)?;
        let a: AppConfig = serde_json::from_slice(&fs::read(&first)?)?;
        let b: AppConfig = serde_json::from_slice(&fs::read(&second)?)?;
        assert!(a.credential_chunks > 1);
        assert_ne!(a.credential_ref, b.credential_ref);
        assert!(!fs::read_to_string(&first)?.contains("secret"));
        assert_eq!(load(&first, &Account::Default, &store)?.token, config.token);
        store
            .0
            .lock()
            .unwrap()
            .remove(&chunk_name(&a.credential_ref, 0));
        assert!(load(&first, &Account::Default, &store).is_err());
        let original = fs::read(&first)?;
        assert!(save(&first, &Account::Default, &AppConfig::default(), &store).is_err());
        assert_eq!(fs::read(&first)?, original);
        assert_eq!(
            load(&second, &Account::Custom("B".into()), &store)?.token,
            config.token
        );
        delete(&second, &store)?;
        assert!(!second.exists());
        assert!(store.get(&chunk_name(&b.credential_ref, 0)).is_err());
        fs::remove_dir_all(root)?;
        Ok(())
    }

    #[test]
    fn copied_config_requires_relogin_on_another_installation() -> Result<()> {
        let root = std::env::temp_dir().join(format!("credential-restore-test-{}", Uuid::new_v4()));
        let source_dir = root.join("source");
        let restored_dir = root.join("restored");
        fs::create_dir_all(&source_dir)?;
        fs::create_dir_all(&restored_dir)?;
        let source = source_dir.join("account.json");
        let restored = restored_dir.join("account.json");
        let store = Mock::default();
        save(
            &source,
            &Account::Default,
            &AppConfig {
                token: "secret".into(),
                ..Default::default()
            },
            &store,
        )?;
        fs::copy(&source, &restored)?;
        assert!(load(&restored, &Account::Default, &store).is_err());
        forget(&restored)?;
        save(
            &restored,
            &Account::Default,
            &AppConfig {
                token: "new-secret".into(),
                ..Default::default()
            },
            &store,
        )?;
        assert_eq!(
            load(&restored, &Account::Default, &store)?.token,
            "new-secret"
        );
        assert_eq!(load(&source, &Account::Default, &store)?.token, "secret");
        fs::remove_dir_all(root)?;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    #[test]
    #[ignore = "requires the current user's Windows Credential Manager; run explicitly"]
    fn windows_credential_manager_round_trip() -> Result<()> {
        let store = OsCredentialStore;
        let name = format!("integration-test-{}", Uuid::new_v4());
        store.put(&name, "test-only-secret")?;
        let result = store.get(&name);
        store.delete(&name)?;
        assert_eq!(result?, "test-only-secret");
        assert!(matches!(
            store.get(&name),
            Err(AppError::CredentialMissing(_))
        ));
        Ok(())
    }
}
