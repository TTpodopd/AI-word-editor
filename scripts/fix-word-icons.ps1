# 修复 Word Ribbon 图标不显示（证书信任 + 清缓存 + 重新注册）
param(
    [switch]$SkipCerts
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ManifestPath = Join-Path $ProjectRoot "manifest.xml"
$WefCache = Join-Path $env:LOCALAPPDATA "Microsoft\Office\16.0\Wef"

Write-Host "=== Word Ribbon 图标修复 ===" -ForegroundColor Cyan

$wordProcs = Get-Process WINWORD -ErrorAction SilentlyContinue
if ($wordProcs) {
    Write-Host "请先完全关闭 Microsoft Word，然后重新运行此脚本。" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n>> 生成图标"
Set-Location $ProjectRoot
node scripts/generate-icons.js

if (-not $SkipCerts) {
    Write-Host "`n>> 安装开发 HTTPS 证书（需管理员权限）"
    npx office-addin-dev-certs install --machine

    $certPath = Join-Path $env:USERPROFILE ".office-addin-dev-certs\localhost.crt"
    if (Test-Path $certPath) {
        Write-Host "`n>> 导入证书到系统受信任根证书"
        try {
            Import-Certificate -FilePath $certPath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
            Write-Host "   已导入 LocalMachine\Root"
        } catch {
            Write-Host "   警告: 自动导入失败，请手动双击安装证书到「受信任的根证书颁发机构」" -ForegroundColor Yellow
            Write-Host "   证书路径: $certPath"
        }
    }
}

if (Test-Path $WefCache) {
    Write-Host "`n>> 清除 Office 插件缓存: $WefCache"
    Remove-Item -Recurse -Force $WefCache
    Write-Host "   已清除"
} else {
    Write-Host "`n>> Office 插件缓存目录不存在，跳过"
}

Write-Host "`n>> 配置 localhost 回环权限"
npx office-addin-dev-settings appcontainer EdgeWebView --loopback --yes
npx office-addin-dev-settings appcontainer "$ManifestPath" --loopback --yes

Write-Host "`n>> 重新注册 manifest"
npx office-addin-dev-settings register "$ManifestPath"

Write-Host "`n=== 完成 ===" -ForegroundColor Green
Write-Host "1. 终端 1 执行: npm start"
Write-Host "2. 终端 2 执行: npm run sideload"
Write-Host "3. 打开 Word，查看 Ribbon 图标"
Write-Host ""
Write-Host "若仍不显示，在 npm start 运行时执行: npm run verify-icons"
