param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localConfig = Join-Path $repoRoot "src-tauri\tauri.local.conf.json"
$sourceExe = Join-Path $repoRoot "src-tauri\target\debug\SJTU Canvas Helper.exe"
$previewRoot = Join-Path $repoRoot "local-preview"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $previewRoot $stamp

Push-Location $repoRoot
try {
  if (!$SkipBuild) {
    & yarn.cmd tauri build --debug --no-bundle --config $localConfig
    if ($LASTEXITCODE -ne 0) {
      throw "Local preview build failed with exit code $LASTEXITCODE."
    }
  }
  if (!(Test-Path -LiteralPath $sourceExe -PathType Leaf)) {
    throw "Preview executable was not found at $sourceExe."
  }

  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
  $outputExe = Join-Path $outputDir "SJTU Canvas Helper.exe"
  Copy-Item -LiteralPath $sourceExe -Destination $outputExe
  $resourceDir = Join-Path $outputDir "python\attendance"
  New-Item -ItemType Directory -Path $resourceDir -Force | Out-Null
  foreach ($name in @("nn.py", "surveil.py", "requirements.txt", "README.md")) {
    Copy-Item -LiteralPath (Join-Path $repoRoot "python\attendance\$name") -Destination (Join-Path $resourceDir $name)
  }
  $checksums = Get-ChildItem -LiteralPath $outputDir -Recurse -File |
    Where-Object { $_.Name -ne "SHA256SUMS.txt" } |
    Sort-Object FullName |
    ForEach-Object {
      $relativePath = $_.FullName.Substring($outputDir.Length + 1).Replace('\', '/')
      "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $relativePath
    }
  Set-Content -LiteralPath (Join-Path $outputDir "SHA256SUMS.txt") -Value $checksums -Encoding ascii
  Write-Host "Local preview executable: $outputExe"
}
finally {
  Pop-Location
}
