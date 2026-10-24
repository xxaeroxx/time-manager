@echo off
rem ============================================================
rem  Dostup s telefona po Wi-Fi (telefon i PK v odnoj seti).
rem  1) Otkryvaet port 8080 v brandmauere Windows (nuzhny prava admina)
rem  2) Pokazyvaet adres, kotoryj nado otkryt' na telefone
rem  Sam sait zapuskaj cherez run.bat (on dolzhen rabotat').
rem ============================================================
cd /d "%~dp0"

rem ---- Esli net prav admina - perezapuskaem sebya s nimi ----
net session >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator rights to open port 8080 in Windows Firewall...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

netsh advfirewall firewall delete rule name="TimeManager 8080" >nul 2>&1
netsh advfirewall firewall add rule name="TimeManager 8080" dir=in action=allow protocol=TCP localport=8080 profile=any >nul
if errorlevel 1 (
  echo [ERROR] Could not add firewall rule.
) else (
  echo [OK] Port 8080 is open in Windows Firewall.
)

echo.
echo ============================================================
echo  On your phone (connected to the SAME Wi-Fi) open:
echo ============================================================
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | ForEach-Object { '   http://' + $_.IPAddress + ':8080      (' + $_.InterfaceAlias + ')' }"
echo.
echo  Usually the right one starts with 192.168. and is on "Wi-Fi" or "Ethernet".
echo  Login and password: see config\application.properties
echo.
pause
