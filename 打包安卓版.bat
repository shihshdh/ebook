@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if not defined ANDROID_HOME set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"
set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"
where java >nul 2>&1
if errorlevel 1 (
  echo 未找到 JDK 17，请将 JDK 17 的 bin 加入 PATH 或配置 JAVA_HOME。
  exit /b 1
)
if not exist "%ANDROID_HOME%\platform-tools" (
  echo 未找到 Android SDK：%ANDROID_HOME%
  exit /b 1
)
if not exist android\keystore.properties (
  echo 没有找到正式签名 android\keystore.properties，只能出未签名的包。
)
call npm run build
if errorlevel 1 exit /b 1
call npx cap sync android
if errorlevel 1 exit /b 1
pushd android
call gradlew.bat assembleRelease
set "BUILD_RESULT=%ERRORLEVEL%"
popd
if not "%BUILD_RESULT%"=="0" exit /b %BUILD_RESULT%
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "VER=%%v"
if not exist release mkdir release
copy /y android\app\build\outputs\apk\release\app-release.apk "release\EBOOK_%VER%.apk" >nul
echo APK 位置：%CD%\release\EBOOK_%VER%.apk
endlocal
