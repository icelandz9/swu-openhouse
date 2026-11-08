@echo off
chcp 65001 > nul
title CPE SWU PhotoBooth - 1-Click Launcher
color 0F

echo ==============================================================================
echo       📸 CPE SWU PhotoBooth - ระบบตู้ถ่ายภาพ Open House 2026 (Windows)
echo ==============================================================================
echo.

:: 1. ตรวจสอบ Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] ไม่พบ Node.js ในเครื่องคอมพิวเตอร์ของคุณ!
    echo.
    echo กรุณาดาวน์โหลดและติดตั้ง Node.js (แนะนำ LTS version) ได้ที่:
    echo https://nodejs.org/en/download
    echo.
    start https://nodejs.org/en/download
    pause
    exit /b 1
)

:: แสดงเวอร์ชัน Node.js
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [✓] ตรวจพบ Node.js: %NODE_VERSION%

:: 2. ตรวจสอบและสร้างไฟล์ .env.local อัตโนมัติ (Zero-Config)
if not exist "web\.env.local" (
    echo [i] ไม่พบ web\.env.local - ระบบกำลังสร้างค่าคอนฟิกเริ่มต้นให้อัตโนมัติ...
    (
        echo # CPE PhotoBooth - Auto-Configured for SWU Open House 2026
        echo STORAGE_DRIVER=r2
        echo NEXT_PUBLIC_APP_URL=https://swu-openhouse.vercel.app
        echo.
        echo # Cloudflare R2 Credentials (Shared CPE SWU Booth Storage)
        echo R2_ACCOUNT_ID=81d53c296f564336b1a33f8dbda1253f
        echo R2_ACCESS_KEY_ID=25c4bdd6d3e440dca9db41028e1be696
        echo R2_SECRET_ACCESS_KEY=ca21152c18f9d8062cb136329df0b8e9fe3bcecc7aaec3136759bee6c5892160
        echo R2_BUCKET_NAME=cpe-swu-photobooth
        echo R2_PUBLIC_DOMAIN=https://pub-9bc7c255344a44dda1d846819ea799b9.r2.dev
        echo.
        echo # HMAC Secret and Admin PIN
        echo AUTH_SECRET=dd4ffede279e18a9105424692ffec64d146633bddc900e5159b7648044084def
        echo ADMIN_PIN=1234
    ) > "web\.env.local"
    echo [✓] สร้าง web\.env.local เรียบร้อย (เชื่อมต่อ Cloudflare R2 และ Vercel Production)
) else (
    echo [✓] พบไฟล์ web\.env.local เรียบร้อย
)

:: 3. ตรวจสอบ node_modules
if not exist "web\node_modules" (
    echo.
    echo [i] ตรวจพบการรันครั้งแรก กำลังติดตั้งแพ็กเกจ (npm install)...
    echo     ขั้นตอนนี้อาจใช้เวลา 1-2 นาที กรุณารอสักครู่...
    call npm install --prefix web
    if %errorlevel% neq 0 (
        echo [ERROR] ติดตั้งแพ็กเกจไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต!
        pause
        exit /b 1
    )
    echo [✓] ติดตั้งแพ็กเกจเสร็จสมบูรณ์
) else (
    echo [✓] Dependencies พร้อมใช้งาน
)

:: 4. สรุปทางลัดการใช้งาน
echo.
echo ==============================================================================
echo  🚀 ระบบพร้อมเริ่มทำงาน! ลิงก์สำหรับเปิดใช้งานหน้าต่างๆ:
echo ==============================================================================
echo  [จอ 1 - ตู้ถ่ายภาพ]:      http://localhost:3000/kiosk
echo  [จอ 2 - แสดงรูป/QR สแกน]: http://localhost:3000/display
echo  [จอแอดมิน - จัดการระบบ]:  http://localhost:3000/admin (PIN: 1234)
echo  [QR Code สแกนบนมือถือ]:   https://swu-openhouse.vercel.app/p/...
echo ==============================================================================
echo.
echo กำลังเปิดหน้าต่างเบราว์เซอร์และสตาร์ทเซิร์ฟเวอร์...
echo (กด Ctrl + C เพื่อหยุดการทำงานของระบบ)
echo.

:: 5. เปิดหน้าเว็บให้อัตโนมัติในเบราว์เซอร์
start http://localhost:3000/kiosk
start http://localhost:3000/display

:: 6. รันเซิร์ฟเวอร์
call npm run dev --prefix web
pause
