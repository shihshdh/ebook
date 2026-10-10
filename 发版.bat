@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
rem 发版：先查代码状态，再打 Windows 安装包和安卓 APK，最后建 GitHub Release、推更新清单（release.mjs）。
rem 要在 main 上、工作区干净、和 GitHub 上的 main 一致；需要 Rust、JDK 17、Android SDK、正式签名、GitHub CLI（gh auth login）。
call node release.mjs --check
if errorlevel 1 exit /b 1
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "VER=%%v"
call "%~dp0打包桌面版.bat"
if errorlevel 1 exit /b 1
if not exist release mkdir release
copy /y "src-tauri\target\release\bundle\nsis\EBOOK_%VER%_x64-setup.exe" "release\EBOOK_%VER%_x64-setup.exe" >nul
if errorlevel 1 (
  echo 没找到安装包 src-tauri\target\release\bundle\nsis\EBOOK_%VER%_x64-setup.exe
  exit /b 1
)
call "%~dp0打包安卓版.bat"
set "BUILD_RESULT=%ERRORLEVEL%"
rem Gradle 守护进程会一直占着一两 G 内存，打完就关
pushd android
call gradlew.bat --stop >nul 2>&1
popd
if not "%BUILD_RESULT%"=="0" exit /b %BUILD_RESULT%
call node release.mjs
if errorlevel 1 exit /b 1
endlocal
