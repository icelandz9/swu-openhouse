@echo off
setlocal enabledelayedexpansion
title CPE SWU PhotoBooth - Setup Assistant
chcp 65001 >nul

echo ======================================================
echo    🛠️ CPE SWU PhotoBooth • Full Environment Setup
echo ======================================================
echo.

:: 1. Unblock PowerShell scripts
echo [*] ปลดล็อก PowerShell Execution Policy (RemoteSigned)...
powershell -NoProfile -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force"
if %errorlevel% equ 0 (
    echo [OK] Execution Policy ปลดล็อกเรียบร้อยแล้ว
) else (
    echo [!] ไม่สามารถตั้งค่า Policy ได้ แต่ยังใช้งานผ่าน start.bat ได้ตามปกติ
)
echo.

:: 2. Install dependencies
echo [*] กำลังติดตั้ง npm dependencies ในโฟลเดอร์ web...
cd web
call npm install
echo.

:: 3. Run Doctor and Asset Bootstrap
echo [*] กำลังเตรียมโมเดล AI MediaPipe, Frame SVG และสติกเกอร์...
node scripts/doctor.mjs --kill-port
node scripts/setup-assets.mjs
node scripts/build-sticker-manifest.mjs
echo.

:: 4. Verify TypeScript Build
echo [*] ตรวจสอบความถูกต้องของโค้ด (Typecheck)...
call npm run typecheck
if %errorlevel% equ 0 (
    echo.
    echo ======================================================
    echo   ✨ การตั้งค่าเสร็จสมบูรณ์ 100%!
    echo   คุณสามารถดับเบิลคลิกที่ start.bat เพื่อเริ่มใช้งานได้ทันที
    echo ======================================================
) else (
    echo [!] พบปัญหา Typecheck กรุณาแจ้งผู้พัฒนา
)
cd ..
echo.
pause
