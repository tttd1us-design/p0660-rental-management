@echo off
echo GitHub Pages 배포 시작...
cd /d %~dp0..
echo 현재 디렉토리: %CD%
echo 빌드 중...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo 빌드 실패!
    exit /b %ERRORLEVEL%
)
echo 빌드 완료. dist 디렉토리 확인...
dir dist
echo GitHub에 푸시 시작...
git add dist -f
git commit -m "Deploy to GitHub Pages"
git push origin main
echo 배포 완료!
pause