param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$TauriArgs
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localConfig = Join-Path $repoRoot "src-tauri\tauri.local.conf.json"
$sourceRelease = Join-Path $repoRoot "src-tauri\target\release"
$outputRelease = Join-Path $repoRoot "release"

Push-Location $repoRoot
try {
  & yarn.cmd tauri build --config $localConfig @TauriArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri release build failed with exit code $LASTEXITCODE."
  }

  $executables = @(Get-ChildItem -LiteralPath $sourceRelease -Filter "*.exe" -File)
  if ($executables.Count -eq 0) {
    throw "No release executable was found in $sourceRelease."
  }

  New-Item -ItemType Directory -Path $outputRelease -Force | Out-Null
  foreach ($executable in $executables) {
    Copy-Item -LiteralPath $executable.FullName -Destination $outputRelease -Force
  }

  $bundleSource = Join-Path $sourceRelease "bundle"
  if (Test-Path -LiteralPath $bundleSource) {
    Copy-Item -LiteralPath $bundleSource -Destination $outputRelease -Recurse -Force
  }

  Write-Host "Release artifacts are available at: $outputRelease"
}
finally {
  Pop-Location
}
