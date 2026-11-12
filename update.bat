@echo off
setlocal
chcp 65001 >nul
title CPE SWU PhotoBooth - Update
cd /d "%~dp0"

echo ======================================================
echo    CPE SWU PhotoBooth : อัปเดตเป็นเวอร์ชันล่าสุด
echo ======================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] ไม่พบ git ในเครื่องนี้ ติดตั้งได้ที่ https://git-scm.com
    pause
    exit /b 1
)

:: 1. Must be the main repo, not a fork
for /f "delims=" %%r in ('git remote get-url origin') do set ORIGIN=%%r
echo [*] repo: %ORIGIN%
echo %ORIGIN% | findstr /i "icelandz9/swu-openhouse" >nul
if %errorlevel% neq 0 (
    echo [!] เครื่องนี้ไม่ได้ clone มาจาก repo หลัก icelandz9/swu-openhouse
    echo     ถ้า clone มาจาก fork ของคนอื่น จะได้โค้ดเก่าจนกว่าเจ้าของ fork จะกด Sync fork
    echo     แก้ได้ด้วย: git remote set-url origin https://github.com/icelandz9/swu-openhouse.git
    echo.
)

:: 2. Stop if there are local edits, so nothing gets lost
git diff --quiet
set DIRTY=%errorlevel%
git diff --cached --quiet
if %errorlevel% neq 0 set DIRTY=1
if %DIRTY% neq 0 (
    echo [!] มีไฟล์ที่แก้ค้างไว้ในเครื่อง:
    git status --short
    echo.
    echo     ถ้าไม่ต้องการเก็บที่แก้ไว้ ให้รัน:  git stash
    echo     แล้วเปิด update.bat ใหม่อีกครั้ง
    pause
    exit /b 1
)

:: 3. Get the latest main
echo [*] กำลังดึงโค้ดล่าสุดจาก GitHub...
git fetch origin
if %errorlevel% neq 0 (
    echo [ERROR] ดึงโค้ดไม่ได้ เช็กอินเทอร์เน็ต
    pause
    exit /b 1
)
git checkout main
git pull --ff-only origin main
if %errorlevel% neq 0 (
    echo [ERROR] pull ไม่สำเร็จ ส่งข้อความด้านบนให้ทีมดู
    pause
    exit /b 1
)

:: 4. Packages
echo [*] กำลังติดตั้ง / อัปเดต npm packages...
cd web
call npm install
cd ..

echo.
for /f "delims=" %%c in ('git log --oneline -1') do echo [OK] อัปเดตเสร็จ เวอร์ชันล่าสุด: %%c
echo.
echo     ขั้นต่อไป: ปิด dev server ตัวเก่า (ถ้าเปิดอยู่) แล้วเปิด start.bat ใหม่
echo     ในเบราว์เซอร์กด Ctrl+Shift+R เพื่อล้างแคชหน้าเว็บ
echo.
pause
