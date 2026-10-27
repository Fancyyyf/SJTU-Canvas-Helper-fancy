# Local app testing

After changes to the desktop app, run relevant checks and create a locally runnable preview with `yarn build:preview:local`. Report the full path of the generated executable. This preview is for testing and does not publish a GitHub Release or update version numbers.

For live iteration, use `yarn app:dev`; it opens the Tauri desktop app and reloads changes. The preview build is kept under `local-preview/<timestamp>/` so a running executable is never overwritten.

<!-- postman-cli:installation:start -->
Postman CLI is installed on this device, and can be used for API Engineering work.
<!-- postman-cli:installation:end -->
