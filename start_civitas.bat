@echo off
rem CIVITAS launcher — serves the terminal on localhost so the File System
rem Access API and the Frontline service worker both work (they need a
rem secure context; localhost qualifies, file:// does not always).
cd /d "%~dp0"
echo.
echo   CIVITAS // COMMAND TERMINAL
echo   Commander:  http://localhost:8765/
echo   Frontline:  http://localhost:8765/frontline/
echo   (Ctrl+C stops the server)
echo.
start "" http://localhost:8765/
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8765
) else (
  py -m http.server 8765
)
