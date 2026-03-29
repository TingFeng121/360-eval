# 360 Eval System - Build + Deploy
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  360 Eval System - Build + Deploy' -ForegroundColor Cyan
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host "Project: $ProjectDir" -ForegroundColor Yellow
Write-Host ''

# Step 1: Build
Write-Host '[1/2] Running npm run build...' -ForegroundColor Green
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host '[FAILED] Build failed.' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

Write-Host ''
Write-Host '[OK] Build succeeded!' -ForegroundColor Green
Write-Host ''

# Step 2: Deploy
Write-Host '[2/2] Deploying to Cloudflare Pages...' -ForegroundColor Green
$env:FORCE_COLOR = '0'
npx wrangler pages deploy dist --project-name=360-eval-system

Write-Host ''
Write-Host '[OK] All done! Visit https://dash.cloudflare.com' -ForegroundColor Green
Write-Host ''
Read-Host 'Press Enter to exit'
