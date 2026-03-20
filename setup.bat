@echo off
title Musica1 Setup
echo.
echo   Checking for Python...
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo   Python not found!
    echo.
    echo   Please install Python 3.10 or higher:
    echo     https://www.python.org/downloads/
    echo.
    echo   Or run: winget install Python.Python.3.10
    echo.
    pause
    exit /b 1
)

python setup_musica1.py
pause
