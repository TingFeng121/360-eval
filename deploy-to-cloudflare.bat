@echo off
cd /d "%~dp0"
npm run build
npx wrangler pages deploy dist --project-name=360-eval-system --no-color
ver >nul
pause
