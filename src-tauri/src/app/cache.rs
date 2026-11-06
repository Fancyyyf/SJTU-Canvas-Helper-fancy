use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    utils::json::parse_json,
};

#[derive(Debug, Default)]
pub struct Cache {
    inner: Mutex<HashMap<String, CacheEntry>>,
}

const MAX_DISK_ENTRY: u64 = 2 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
struct DiskEntry {
    version: u8,
    expires_at: u64,
    nonce: String,
    ciphertext: String,
}

/// Only callers with safe, URL-free projections should use this cache.
pub struct DiskCache {
    root: PathBuf,
}

impl DiskCache {
    pub fn new(config_dir: &Path) -> Self {
        Self {
            root: config_dir.join("metadata-cache-v1"),
        }
    }

    fn path(&self, key: &str) -> PathBuf {
        self.root
            .join(format!("{:x}.json", Sha256::digest(key.as_bytes())))
    }

    fn cipher(token: &str) -> Option<Aes256Gcm> {
        if token.is_empty() {
            return None;
        }
        let mut hasher = Sha256::new();
        hasher.update(b"SJTU-Canvas-Helper metadata-cache-v1\0");
        hasher.update(token.as_bytes());
        Some(Aes256Gcm::new_from_slice(&hasher.finalize()).expect("SHA256 is 32 bytes"))
    }

    pub fn get<V: DeserializeOwned>(&self, key: &str, token: &str) -> Option<V> {
        let cipher = Self::cipher(token)?;
        if fs::symlink_metadata(&self.root)
            .ok()?
            .file_type()
            .is_symlink()
        {
            return None;
        }
        let path = self.path(key);
        let metadata = fs::symlink_metadata(&path).ok()?;
        if !metadata.file_type().is_file() || metadata.len() > MAX_DISK_ENTRY {
            return None;
        }
        let bytes = fs::read(&path).ok()?;
        let entry: DiskEntry = serde_json::from_slice(&bytes).ok()?;
        let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
        if entry.version != 1 || now >= entry.expires_at {
            let _ = fs::remove_file(path);
            return None;
        }
        let nonce = STANDARD.decode(entry.nonce).ok()?;
        if nonce.len() != 12 {
            return None;
        }
        let ciphertext = STANDARD.decode(entry.ciphertext).ok()?;
        let plaintext = cipher
            .decrypt(
                Nonce::from_slice(&nonce),
                Payload {
                    msg: &ciphertext,
                    aad: key.as_bytes(),
                },
            )
            .ok()?;
        serde_json::from_slice(&plaintext).ok()
    }

    pub fn set<V: Serialize>(
        &self,
        key: &str,
        token: &str,
        value: &V,
        ttl: Duration,
    ) -> Result<()> {
        let Some(cipher) = Self::cipher(token) else {
            return Ok(());
        };
        fs::create_dir_all(&self.root)?;
        if fs::symlink_metadata(&self.root)?.file_type().is_symlink() {
            return Err(AppError::CredentialStore("缓存目录不可为符号链接".into()));
        }
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let plaintext = serde_json::to_vec(value)?;
        if plaintext.len() as u64 > MAX_DISK_ENTRY / 2 {
            return Err(AppError::CredentialStore("缓存条目超过大小上限".into()));
        }
        let ciphertext = cipher
            .encrypt(
                &nonce,
                Payload {
                    msg: &plaintext,
                    aad: key.as_bytes(),
                },
            )
            .map_err(|_| AppError::CredentialStore("缓存加密失败".into()))?;
        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| AppError::CredentialStore("系统时间无效".into()))?
            .as_secs()
            .saturating_add(ttl.as_secs());
        let entry = DiskEntry {
            version: 1,
            expires_at,
            nonce: STANDARD.encode(nonce),
            ciphertext: STANDARD.encode(ciphertext),
        };
        let path = self.path(key);
        let temporary = self.root.join(format!(".{}.tmp", Uuid::new_v4()));
        let result = (|| {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)?;
            file.write_all(&serde_json::to_vec(&entry)?)?;
            file.sync_all()?;
            drop(file);
            fs::rename(&temporary, path)?;
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(temporary);
        }
        result
    }

    pub fn clear(&self) -> Result<()> {
        if !self.root.exists() {
            return Ok(());
        }
        if fs::symlink_metadata(&self.root)?.file_type().is_symlink() {
            return Err(AppError::CredentialStore("缓存目录不可为符号链接".into()));
        }
        for entry in fs::read_dir(&self.root)? {
            let path = entry?.path();
            if path.extension().is_some_and(|ext| ext == "json")
                && fs::symlink_metadata(&path)?.file_type().is_file()
            {
                fs::remove_file(path)?;
            }
        }
        Ok(())
    }
}

#[derive(Debug)]
struct CacheEntry {
    value: String,
    expires_at: Option<Instant>,
}

impl Cache {
    pub fn get<V>(&self, key: &str) -> Result<Option<V>>
    where
        V: DeserializeOwned + Serialize,
    {
        let mut cache = self.inner.lock().map_err(|_| AppError::MutexError)?;
        if cache
            .get(key)
            .is_some_and(|entry| entry.expires_at.is_some_and(|at| Instant::now() >= at))
        {
            cache.remove(key);
        }
        let value = cache.get(key);
        match value {
            Some(v) => {
                let value = parse_json(v.value.as_bytes())?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    pub fn set<K, V>(&self, key: K, value: V) -> Result<()>
    where
        K: Into<String>,
        V: DeserializeOwned + Serialize,
    {
        self.set_with_expiry(key, value, None)
    }

    pub fn set_with_ttl<K, V>(&self, key: K, value: V, ttl: Duration) -> Result<()>
    where
        K: Into<String>,
        V: DeserializeOwned + Serialize,
    {
        self.set_with_expiry(key, value, Some(Instant::now() + ttl))
    }

    fn set_with_expiry<K, V>(&self, key: K, value: V, expires_at: Option<Instant>) -> Result<()>
    where
        K: Into<String>,
        V: DeserializeOwned + Serialize,
    {
        let mut cache = self.inner.lock().map_err(|_| AppError::MutexError)?;
        let value = serde_json::to_string(&value)?;
        cache.insert(key.into(), CacheEntry { value, expires_at });
        Ok(())
    }

    pub fn clear(&self) -> Result<()> {
        let mut cache = self.inner.lock().map_err(|_| AppError::MutexError)?;
        cache.clear();
        Ok(())
    }

    #[allow(dead_code)]
    pub fn remove<V>(&self, key: &str) -> Result<Option<V>>
    where
        V: DeserializeOwned + Serialize,
    {
        let mut cache = self.inner.lock().map_err(|_| AppError::MutexError)?;

        let value = cache.get(key);
        match value {
            Some(v) => {
                let value = parse_json(v.value.as_bytes())?;
                cache.remove(key);
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }
}

mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
    #[allow(dead_code)] // only for test
    struct Person {
        age: usize,
        gender: String,
        name: String,
    }

    #[derive(Serialize, Deserialize)]
    #[allow(dead_code)] // only for test
    struct Pet {
        name: String,
        owner: String,
    }

    #[test]
    fn test_cache() -> Result<()> {
        const PERSON_CACHE_KEY: &str = "person_cache_key";
        let test_person = Person {
            age: 25,
            gender: "male".to_owned(),
            name: "Alice".to_owned(),
        };

        let cache = Cache::default();

        // person is not set yet
        let mut person: Option<Person> = cache.get(PERSON_CACHE_KEY)?;
        assert!(person.is_none());
        // set person
        cache.set(PERSON_CACHE_KEY, test_person.clone()).unwrap();
        // person is now set
        person = cache.get(PERSON_CACHE_KEY)?;
        assert!(person.is_some());
        assert_eq!(test_person, person.unwrap());

        // try to get person as a pet, will fail
        let result: Result<Option<Pet>> = cache.get(PERSON_CACHE_KEY);
        assert!(result.is_err());
        Ok(())
    }

    #[test]
    fn expired_entry_is_refetched() -> Result<()> {
        let cache = Cache::default();
        cache.set_with_ttl("courses", vec![1], Duration::ZERO)?;
        assert!(cache.get::<Vec<i32>>("courses")?.is_none());
        Ok(())
    }

    #[test]
    fn disk_cache_is_encrypted_scoped_and_expires() -> Result<()> {
        let root = std::env::temp_dir().join(format!("safe-cache-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root)?;
        let cache = DiskCache::new(&root);
        let value = serde_json::json!({ "name": "private-course-name" });
        cache.set(
            "account-a:safe-files",
            "canvas-token",
            &value,
            Duration::from_secs(60),
        )?;
        let file = cache.path("account-a:safe-files");
        assert!(!fs::read_to_string(&file)?.contains("private-course-name"));
        assert_eq!(
            cache.get::<serde_json::Value>("account-a:safe-files", "canvas-token"),
            Some(value)
        );
        assert!(cache
            .get::<serde_json::Value>("account-a:safe-files", "other-token")
            .is_none());
        cache.set("expired", "canvas-token", &42, Duration::ZERO)?;
        assert!(cache.get::<i32>("expired", "canvas-token").is_none());
        cache.clear()?;
        assert!(cache
            .get::<serde_json::Value>("account-a:safe-files", "canvas-token")
            .is_none());
        fs::remove_dir_all(root)?;
        Ok(())
    }
}
