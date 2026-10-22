param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$TauriArgs
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localConfig = Join-Path $repoRoot "src-tauri\tauri.local.conf.json"
$sourceRelease = Join-Path $repoRoot "src-tauri\target\release"
$version = (Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json).version
$outputRelease = Join-Path $repoRoot "release\$version"

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
    $versionedName = "{0}_{1}{2}" -f $executable.BaseName, $version, $executable.Extension
    Copy-Item -LiteralPath $executable.FullName -Destination (Join-Path $outputRelease $versionedName) -Force
    try {
      Copy-Item -LiteralPath $executable.FullName -Destination (Join-Path (Join-Path $repoRoot "release") $executable.Name) -Force
    }
    catch [System.IO.IOException] {
      Write-Warning "The latest executable is in use; run release\$version\$versionedName instead."
    }
  }

  $bundleSource = Join-Path $sourceRelease "bundle"
  if (Test-Path -LiteralPath $bundleSource) {
    Get-ChildItem -LiteralPath $bundleSource -Recurse -File |
      Where-Object { $_.Name.Contains("_$version") } |
      ForEach-Object {
        $relativePath = $_.FullName.Substring($bundleSource.Length).TrimStart('\', '/')
        $destination = Join-Path (Join-Path $outputRelease "bundle") $relativePath
        New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
      }
  }

  $checksums = Get-ChildItem -LiteralPath $outputRelease -Recurse -File |
    Where-Object { $_.Name -ne "SHA256SUMS.txt" } |
    Sort-Object FullName |
    ForEach-Object {
      $relativePath = $_.FullName.Substring($outputRelease.Length + 1).Replace('\', '/')
      "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $relativePath
    }
  Set-Content -LiteralPath (Join-Path $outputRelease "SHA256SUMS.txt") -Value $checksums -Encoding ascii

  Write-Host "Release artifacts are available at: $outputRelease"
}
finally {
  Pop-Location
}
