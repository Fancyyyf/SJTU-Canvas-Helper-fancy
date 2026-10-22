@echo off
setlocal
set "LOCAL_VERSION=3.0.16"
set "LOCAL_MSI=%~dp0..\release\%LOCAL_VERSION%\bundle\msi\SJTU Canvas Helper_%LOCAL_VERSION%_x64_en-US.msi"
if exist "%LOCAL_MSI%" (
    echo Installing local SJTU Canvas Helper v%LOCAL_VERSION% ...
    msiexec /i "%LOCAL_MSI%" /qb
    if errorlevel 1 exit /b 1
    exit /b 0
)

set "VERSION=3.0.16"
set "URL=https://github.com/Fancyyyf/SJTU-Canvas-Helper-fancy/releases/download/app-v%VERSION%/SJTU.Canvas.Helper_%VERSION%_x64-setup.exe"
set "INSTALLER=SJTU.Canvas.Helper_%VERSION%_x64-setup.exe"

echo ============================================
echo   SJTU Canvas Helper v%VERSION% Installer
echo ============================================
echo.
echo Downloading %INSTALLER% ...
echo.

powershell -Command "Invoke-WebRequest -Uri '%URL%' -OutFile '%INSTALLER%'"

if %ERRORLEVEL% neq 0 (
    echo Download failed! Please check your network connection.
    pause
    exit /b 1
)

echo.
echo Download complete. Installing...
echo.

start /wait "" "%INSTALLER%"
if %ERRORLEVEL% neq 0 (
    echo Installation failed.
    pause
    exit /b 1
)

echo.
echo Installation completed successfully!
del "%INSTALLER%"
pause
