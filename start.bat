@echo off
setlocal enabledelayedexpansion
title CPE SWU PhotoBooth - Quick Starter
chcp 65001 >nul

echo ======================================================
echo    📸 CPE SWU PhotoBooth • 1-Click Zero-Friction Launcher
echo ======================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] ไม่พบ Node.js ในเครื่องนี้!
    echo กรุณาดาวน์โหลดและติดตั้ง Node.js (v20, v22 หรือ v24) ได้ที่ https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 2. Auto-configure PowerShell execution policy for current user silently
powershell -NoProfile -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force" >nul 2>nul

:: 3. Check if web/node_modules exists
if not exist "web\node_modules\@mediapipe\tasks-vision" (
    echo [*] ตรวจพบการรันครั้งแรก (First-time setup)...
    echo [*] กำลังติดตั้ง npm packages อัตโนมัติ...
    cd web
    call npm install
    cd ..
)

:: 4. Clear port 3000 if occupied from previous crashes
echo [*] ตรวจสอบและเคลียร์ Port 3000 อัตโนมัติ...
node web/scripts/kill-port.mjs 3000

:: 5. Run Doctor Check & Asset Verification
echo [*] ตรวจสอบความสมบูรณ์ของระบบ...
node web/scripts/doctor.mjs

:: 6. Launch Chrome/Default Browser in background after 3 seconds
start "" /b cmd /c "timeout /t 4 >nul && start http://localhost:3000/launchpad"

:: 7. Start Dev Server
echo [*] กำลังเปิดเซิร์ฟเวอร์ PhotoBooth...
cd web
call npm run dev
