@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>&1
if errorlevel 1 goto bundled
set "ND_NODE=node.exe"
goto launch

:bundled
set "ND_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%ND_NODE%" goto launch
echo.
echo NEON DRIFT: Node.js was not found.
echo Open index.html directly in your browser to play offline.
echo This launcher does not install anything.
echo.
pause
exit /b 1

:launch
if not defined PORT set "PORT=4177"
echo.
echo NEON DRIFT - Night shift
echo Keep this window open while playing. Ctrl+C stops the server.
echo.
"%ND_NODE%" "%~dp0server.cjs" --open
if errorlevel 1 pause
endlocal
