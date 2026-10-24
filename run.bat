@echo off
rem ============================================================
rem  Time Manager - zapusk bez IDE.
rem  1) Ishchet JDK (s kompilyatorom javac)  2) Skachivaet Maven
rem  3) Kompiliruet (log v build-log.txt)  4) Zapuskaet sait
rem ============================================================
cd /d "%~dp0"
setlocal EnableDelayedExpansion

rem ---- 1. Ishchem JDK ----
set "JDK="
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\javac.exe" set "JDK=%JAVA_HOME%"
if not defined JDK (
  for /d %%D in ("%USERPROFILE%\.jdks\*") do (
    if exist "%%D\bin\javac.exe" (
      echo %%~nxD | findstr /i /c:"-ea" /c:"valhalla" >nul || set "JDK=%%D"
    )
  )
)
if not defined JDK (
  for /d %%D in ("C:\Program Files\Eclipse Adoptium\jdk*" "C:\Program Files\Java\jdk*" "C:\Program Files\Microsoft\jdk*" "C:\Program Files\Amazon Corretto\jdk*") do (
    if exist "%%D\bin\javac.exe" set "JDK=%%D"
  )
)
if not defined JDK (
  for /f "delims=" %%J in ('where javac 2^>nul') do if not defined JDK set "JDK=%%~dpJ.."
)
if not defined JDK goto nojava

set "JAVA_HOME=%JDK%"
set "PATH=%JDK%\bin;%PATH%"
echo Using JDK: %JDK%
"%JDK%\bin\java" -version

rem ---- 2. Maven ----
set "MVN_VER=3.9.9"
set "MVN_HOME=%~dp0.tools\apache-maven-%MVN_VER%"
if exist "%MVN_HOME%\bin\mvn.cmd" goto build

echo Downloading Maven %MVN_VER% (one time, ~10 MB)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; New-Item -ItemType Directory -Force '.tools' | Out-Null; Invoke-WebRequest 'https://archive.apache.org/dist/maven/maven-3/%MVN_VER%/binaries/apache-maven-%MVN_VER%-bin.zip' -OutFile '.tools\maven.zip'; Expand-Archive '.tools\maven.zip' '.tools' -Force; Remove-Item '.tools\maven.zip'"
if errorlevel 1 goto nomaven

rem ---- 3. Kompilyaciya (log v build-log.txt) ----
:build
echo.
echo Compiling... (first time downloads libraries, 1-3 min)
call "%MVN_HOME%\bin\mvn.cmd" -B -l build-log.txt clean compile
if errorlevel 1 goto buildfail

rem ---- 4. Zapusk ----
echo.
echo Starting the app at http://localhost:8080
echo To stop the server: close this window or press Ctrl+C
echo.
start "" /min cmd /c "timeout /t 20 >nul & start http://localhost:8080"
call "%MVN_HOME%\bin\mvn.cmd" -B spring-boot:run
pause
exit /b

:buildfail
echo.
echo [ERROR] Build failed. Details are in build-log.txt
powershell -NoProfile -Command "Get-Content build-log.txt | Select-String 'ERROR' | Select-Object -First 25"
pause
exit /b 1

:nojava
echo [ERROR] JDK not found (need JDK 17+ with javac).
echo         Install: https://adoptium.net  (Temurin 21, Windows x64 .msi)
echo         During install enable "Set JAVA_HOME" and "Add to PATH".
pause
exit /b 1

:nomaven
echo [ERROR] Could not download Maven. Check your internet connection.
pause
exit /b 1
