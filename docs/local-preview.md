# 本地调试版本

开发时运行 `yarn app:dev`，它会启动桌面 App；前端改动会热更新，Rust 改动会重新编译。

每次需要给测试者一个固定版本时，在仓库根目录运行 `yarn build:preview:local`。脚本执行 Tauri 的 debug/no-bundle 构建，并把可执行文件、运行资源与 SHA-256 清单复制到 `local-preview/<构建时间>/`。这个目录被 Git 忽略；构建过程不会创建或上传 GitHub Release，也不会修改应用版本号。

运行目录中的 `SJTU Canvas Helper.exe` 即可测试。每次构建生成新的时间戳目录，方便保留旧版作对比，也不会覆盖正在运行的程序。需要安装包时仍可使用 `yarn build:release:local`；它只在本地生成文件，不负责发布。
