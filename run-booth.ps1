# ========================================================
# CPE SWU PhotoBooth - PowerShell Runner
# ========================================================
[CmdletBinding()]
param (
    [switch]$SkipBrowser,
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
Write-Host "`n📸 [SWU PhotoBooth] กำลังเตรียมความพร้อมระบบ..." -ForegroundColor Cyan

# 1. Unblock Execution Policy for current user
try {
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force -ErrorAction SilentlyContinue
} catch {}

# 2. Free port if occupied
Write-Host "[*] ตรวจสอบ Port $Port..." -ForegroundColor Yellow
node web/scripts/kill-port.mjs $Port

# 3. Check dependencies
if (-not (Test-Path "web/node_modules/@mediapipe/tasks-vision")) {
    Write-Host "[*] กำลังติดตั้ง npm packages..." -ForegroundColor Yellow
    npm install --prefix web
}

# 4. Run Doctor Pre-flight
node web/scripts/doctor.mjs

# 5. Open browser if requested
if (-not $SkipBrowser) {
    Start-Job -ScriptBlock {
        Start-Sleep -Seconds 4
        Start-Process "http://localhost:3000/launchpad"
    } | Out-Null
}

# 6. Start Dev Server
Write-Host "`n🚀 กำลังเปิดเซิร์ฟเวอร์ PhotoBooth... (กด Ctrl+C เพื่อหยุด)" -ForegroundColor Green
Set-Location "web"
npm run dev
