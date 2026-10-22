type ProgressId = { courseFolder: string; stem: string; mode: "clean" | "knowledge" };

export function agentProgressKey(progress: ProgressId): string {
  return JSON.stringify([progress.courseFolder, progress.stem, progress.mode]);
}
