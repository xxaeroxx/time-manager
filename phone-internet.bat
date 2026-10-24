@echo off
rem ============================================================
rem  Dostup s telefona IZ LYUBOGO MESTA (mobil'nyj internet),
rem  rabotaet dazhe s SERYM IP. Ispol'zuet besplatnyj Cloudflare
rem  Tunnel (bez registracii). Dayot ssylku vida
rem  https://xxxx.trycloudflare.com - otkroj eyo na telefone.
rem  Sam sait zapuskaj cherez run.bat (on dolzhen rabotat').
rem  Ssylka MENYAETSYA pri kazhdom zapuske etogo fajla.
rem ============================================================
cd /d "%~dp0"
if exist tunnel.log del tunnel.log

set "CF=%~dp0.tools\cloudflared.exe"
if exist "%CF%" goto run

echo Downloading cloudflared (one time, ~60 MB)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; New-Item -ItemType Directory -Force '.tools' | Out-Null; Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '.tools\cloudflared.exe'"
if errorlevel 1 (
  echo [ERROR] Could not download cloudflared. Check your internet connection.
  pause
  exit /b 1
)

:run
echo.
echo ============================================================
echo  Wait ~10 seconds. Find a line with a link like:
echo     https://something-random.trycloudflare.com
echo  Open it on your phone. Login/password - from config\application.properties
echo  Keep this window open while you use the site.
echo ============================================================
echo.
"%CF%" tunnel --no-autoupdate --logfile "%~dp0tunnel.log" --url http://localhost:8080
pause
