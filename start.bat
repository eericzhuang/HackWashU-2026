@echo off
chcp 65001 >nul 2>&1
title Dialogue Divergence Tree
cd /d "%~dp0dialogue-tree"

echo.
echo   ========================================
echo     Dialogue Divergence Tree
echo   ========================================
echo.

:: 1. Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Node.js is not installed.
    echo   Please download it from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 2. Install dependencies if needed
if not exist "node_modules\" (
    echo   [*] First run - installing dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo   [ERROR] npm install failed. Check your network connection.
        pause
        exit /b 1
    )
    echo.
    echo   [OK] Dependencies installed.
    echo.
)

:: 3. Create .env if missing
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo   [*] Created .env from template.
    ) else (
        echo   [ERROR] .env.example not found.
        pause
        exit /b 1
    )
    echo   [!] You need to configure your API key before the app can work.
    echo       Opening .env in Notepad - set LLM_API_KEY to your key, then save and close.
    echo.
    start /wait notepad ".env"
    echo   [OK] .env saved.
    echo.
    goto :start_server
)

:: 4. Check if API key is still a placeholder
findstr /C:"your-key-here" ".env" >nul 2>&1
if not errorlevel 1 (
    echo   [!] API key is not configured yet.
    echo       Opening .env in Notepad - set LLM_API_KEY to your key, then save and close.
    echo.
    start /wait notepad ".env"
    echo   [OK] .env updated.
    echo.
)

:start_server
echo   [*] Starting server...
echo       The app will open in your default browser.
echo       Press Ctrl+C here to stop.
echo.
npm run dev -- --open
