@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
where cargo >nul 2>&1
if errorlevel 1 (
  echo 未找到 Rust，请先安装 Rust MSVC 工具链和 Visual Studio C++ Build Tools。
  exit /b 1
)
if not exist node_modules\@tauri-apps\cli call npm install
if errorlevel 1 exit /b 1
call npm run desktop:build
if errorlevel 1 exit /b 1
echo 安装包位置：%CD%\src-tauri\target\release\bundle\nsis
endlocal
