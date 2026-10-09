param([switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
$releaseVersion = (Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json).version
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\src-tauri\target\release'))
$releaseInstaller = Join-Path $releaseRoot "bundle\nsis\EBOOK_${releaseVersion}_x64-setup.exe"
$releaseBinary = Join-Path $releaseRoot 'EBOOK.exe'
if (!(Test-Path -LiteralPath $releaseInstaller) -or !(Test-Path -LiteralPath $releaseBinary)) { throw '缺少已构建的安装包或主程序' }
if ((Get-Item -LiteralPath $releaseBinary).VersionInfo.ProductVersion -ne $releaseVersion) { throw '主程序版本不匹配' }

$desktopPath = [Environment]::GetFolderPath('Desktop')
$desktopInstaller = Join-Path $desktopPath "EBOOK_${releaseVersion}_x64-setup.exe"
$shortcutPath = Join-Path $desktopPath 'EBOOK.lnk'
$shortcutShell = New-Object -ComObject WScript.Shell
$installDirectory = Join-Path $env:LOCALAPPDATA 'EBOOK'
if (Test-Path -LiteralPath $shortcutPath) {
    $existingTarget = $shortcutShell.CreateShortcut($shortcutPath).TargetPath
    if ((Split-Path $existingTarget -Leaf) -eq 'EBOOK.exe' -and (Test-Path -LiteralPath $existingTarget)) {
        $installDirectory = Split-Path $existingTarget -Parent
    }
}
$installedBinary = Join-Path $installDirectory 'EBOOK.exe'
if (!$VerifyOnly) {
foreach ($appProcess in @(Get-Process EBOOK -ErrorAction SilentlyContinue)) {
    if ($appProcess.Path -eq $installedBinary) {
        [void]$appProcess.CloseMainWindow()
        if (!$appProcess.WaitForExit(10000)) { throw 'EBOOK 仍在运行，请先保存并关闭应用后重试安装' }
    }
}

Copy-Item -LiteralPath $releaseInstaller -Destination $desktopInstaller -Force
$installation = Start-Process -FilePath $desktopInstaller -ArgumentList @('/S', '/UPDATE', "/D=$installDirectory") -WindowStyle Hidden -PassThru -Wait
if ($installation.ExitCode -ne 0) { throw "安装失败，退出码 $($installation.ExitCode)" }
}
if (!(Test-Path -LiteralPath $installedBinary)) { throw '安装结束后未找到主程序' }
# Tauri 把包内程序的 UNK 标记设为 NSS，打包后又恢复 target/release 中的原文件。
# 按相同方式替换唯一的标记后，比较整个程序的 SHA256，而不是跳过内容验证。
$expectedBytes = [IO.File]::ReadAllBytes($releaseBinary)
$binaryText = [Text.Encoding]::GetEncoding(28591).GetString($expectedBytes)
$marker = '__TAURI_BUNDLE_TYPE_VAR_UNK'
$markerAt = $binaryText.IndexOf($marker, [StringComparison]::Ordinal)
if ($markerAt -ge 0) {
    if ($binaryText.IndexOf($marker, $markerAt + 1, [StringComparison]::Ordinal) -ge 0) { throw '发现多个 Tauri 包类型标记' }
    $replacement = [Text.Encoding]::ASCII.GetBytes('__TAURI_BUNDLE_TYPE_VAR_NSS')
    [Array]::Copy($replacement, 0, $expectedBytes, $markerAt, $replacement.Length)
}
$sha = [Security.Cryptography.SHA256]::Create()
try { $expectedHash = [BitConverter]::ToString($sha.ComputeHash($expectedBytes)).Replace('-', '') } finally { $sha.Dispose() }
if ((Get-FileHash -LiteralPath $installedBinary).Hash -ne $expectedHash) { throw '已安装主程序与 NSIS 构建内容不一致' }

$shortcut = $shortcutShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $installedBinary
$shortcut.WorkingDirectory = $installDirectory
$shortcut.IconLocation = "$installedBinary,0"
$shortcut.Description = "EBOOK $releaseVersion"
$shortcut.Save()
[pscustomobject]@{
    Version = (Get-Item -LiteralPath $installedBinary).VersionInfo.ProductVersion
    Installed = $installedBinary
    Installer = $desktopInstaller
    Shortcut = $shortcutPath
    SHA256 = (Get-FileHash -LiteralPath $desktopInstaller).Hash
} | ConvertTo-Json
