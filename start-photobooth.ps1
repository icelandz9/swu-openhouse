# ==============================================================================
# CPE SWU PhotoBooth - 1-Click PowerShell Runner (Windows)
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "CPE SWU PhotoBooth - Launcher"

Write-Host "==============================================================================" -ForegroundColor Red
Write-Host "      📸 CPE SWU PhotoBooth - ระบบตู้ถ่ายภาพ Open House 2026 (PowerShell)" -ForegroundColor White
Write-Host "==============================================================================" -ForegroundColor Red
Write-Host ""

# 1. ตรวจสอบ Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] ไม่พบ Node.js ในเครื่องคอมพิวเตอร์ของคุณ!" -ForegroundColor Red
    Write-Host "กรุณาดาวน์โหลดและติดตั้ง Node.js ได้ที่: https://nodejs.org/en/download" -ForegroundColor Yellow
    Start-Process "https://nodejs.org/en/download"
    Read-Host "กด Enter เพื่อออก"
    exit 1
}

$nodeVer = node -v
Write-Host "[✓] ตรวจพบ Node.js: $nodeVer" -ForegroundColor Green

# 2. ตรวจสอบไฟล์ .env.local
$envPath = "web\.env.local"
if (-not (Test-Path $envPath)) {
    Write-Host "[i] ไม่พบ $envPath - กำลังสร้างคอนฟิกสำหรับงาน Open House อัตโนมัติ..." -ForegroundColor Cyan
    $envContent = @"
# CPE PhotoBooth - Auto-Configured for SWU Open House 2026
STORAGE_DRIVER=r2
NEXT_PUBLIC_APP_URL=https://swu-openhouse.vercel.app

# Cloudflare R2 Credentials (Shared CPE SWU Booth Storage)
R2_ACCOUNT_ID=81d53c296f564336b1a33f8dbda1253f
R2_ACCESS_KEY_ID=25c4bdd6d3e440dca9db41028e1be696
R2_SECRET_ACCESS_KEY=ca21152c18f9d8062cb136329df0b8e9fe3bcecc7aaec3136759bee6c5892160
R2_BUCKET_NAME=cpe-swu-photobooth
R2_PUBLIC_DOMAIN=https://pub-9bc7c255344a44dda1d846819ea799b9.r2.dev

# HMAC Secret and Admin PIN
AUTH_SECRET=dd4ffede279e18a9105424692ffec64d146633bddc900e5159b7648044084def
ADMIN_PIN=1234
"@
    Set-Content -Path $envPath -Value $envContent -Encoding UTF8
    Write-Host "[✓] สร้าง $envPath เรียบร้อย (Cloudflare R2 + Production Fallback)" -ForegroundColor Green
} else {
    Write-Host "[✓] พบไฟล์ $envPath เรียบร้อย" -ForegroundColor Green
}

# 3. ตรวจสอบ node_modules
if (-not (Test-Path "web\node_modules")) {
    Write-Host "[i] ติดตั้ง Dependencies (npm install)... กรุณารอสักครู่ (ทำครั้งแรกครั้งเดียว)" -ForegroundColor Cyan
    npm install --prefix web
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] การติดตั้ง dependencies ขัดข้อง กรุณาเช็คอินเทอร์เน็ต" -ForegroundColor Red
        Read-Host "กด Enter เพื่อออก"
        exit 1
    }
    Write-Host "[✓] ติดตั้ง Dependencies เสร็จสมบูรณ์" -ForegroundColor Green
} else {
    Write-Host "[✓] Dependencies พร้อมใช้งาน" -ForegroundColor Green
}

# 4. ค้นหา IPv4 ของเครื่องในวง LAN
$localIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*" -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^169\.254\.' -and $_.IPAddress -notmatch '^127\.' } | Select-Object -First 1).IPAddress
if (-not $localIp) { $localIp = "localhost" }

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor DarkGray
Write-Host "  🚀 ระบบพร้อมเริ่มทำงาน! ลิงก์สำหรับเปิดใช้งาน:" -ForegroundColor White
Write-Host "  [จอ 1 - ตู้ถ่ายภาพ]:      http://localhost:3000/kiosk" -ForegroundColor Yellow
Write-Host "  [จอ 2 - แสดงรูป/QR สแกน]: http://localhost:3000/display" -ForegroundColor Yellow
Write-Host "  [จอแอดมิน - จัดการระบบ]:  http://localhost:3000/admin (PIN: 1234)" -ForegroundColor Yellow
Write-Host "  [LAN IP วงเดียวกัน]:      http://${localIp}:3000" -ForegroundColor Cyan
Write-Host "  [QR Code สแกนบนมือถือ]:   https://swu-openhouse.vercel.app/p/..." -ForegroundColor Magenta
Write-Host "==============================================================================" -ForegroundColor DarkGray
Write-Host ""

Start-Process "http://localhost:3000/kiosk"
Start-Process "http://localhost:3000/display"

npm run dev --prefix web
