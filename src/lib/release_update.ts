import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface ReleaseUpdate {
  version: string;
  releaseUrl: string;
  installerAvailable: boolean;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
}

export function checkReleaseUpdate(): Promise<ReleaseUpdate | null> {
  return invoke<ReleaseUpdate | null>("check_release_update");
}

export async function installReleaseUpdate(
  version: string,
  onProgress: (progress: DownloadProgress) => void
): Promise<void> {
  const unlisten = await listen<DownloadProgress>("release-update-progress", (event) => {
    onProgress(event.payload);
  });
  try {
    await invoke("install_release_update", { expectedVersion: version });
  } finally {
    unlisten();
  }
}
