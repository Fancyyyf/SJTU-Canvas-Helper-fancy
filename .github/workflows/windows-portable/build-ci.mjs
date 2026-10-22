import { createPortableArchive } from "./portable-archive.mjs";

await createPortableArchive({
  target: "x86_64-pc-windows-msvc",
  configPath: "./src-tauri/tauri.conf.json",
  releaseDir: "./src-tauri/target/x86_64-pc-windows-msvc/release",
  outputDir: "./release-ci",
});
