@echo off
title RC Stable Audio Tools + Composer

echo Starting Gradio (port 7860) and Composer (port 8000)...
echo.

:: Start Gradio in a new window
start "Gradio - Audio Generator" cmd /k "cd /d %~dp0 && uv run python run_gradio.py"

:: Wait for Gradio to begin loading
timeout /t 5 /nobreak >nul

:: Build composer frontend if needed
if not exist "%~dp0composer\dist" (
    echo Building composer frontend...
    cd /d "%~dp0composer"
    call npm run build
    cd /d "%~dp0"
)

:: Start Composer in a new window
start "Composer - Multi-Track DAW" cmd /k "cd /d %~dp0 && uv run python -m composer.server.app"

echo.
echo Both services starting:
echo   Gradio:   http://localhost:7860
echo   Composer: http://localhost:8000
echo.
echo Close this window or press any key to exit.
pause >nul
