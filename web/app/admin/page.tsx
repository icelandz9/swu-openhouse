'use client';

import { useState, useEffect } from 'react';

interface PhotoRecord {
  code: string;
  photoUrl: string;
  qrUrl: string;
  capturedAt: string;
  syncedToCloud: boolean;
}

const INITIAL_PHOTOS: PhotoRecord[] = [
  {
    code: '8884',
    photoUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80',
    qrUrl: 'http://192.168.1.10:3000/p/8884',
    capturedAt: '17:40:12',
    syncedToCloud: true,
  },
  {
    code: '7721',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    qrUrl: 'http://192.168.1.10:3000/p/7721',
    capturedAt: '17:36:45',
    syncedToCloud: true,
  },
  {
    code: '6590',
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    qrUrl: 'http://192.168.1.10:3000/p/6590',
    capturedAt: '17:32:10',
    syncedToCloud: true,
  },
  {
    code: '5412',
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
    qrUrl: 'http://192.168.1.10:3000/p/5412',
    capturedAt: '17:28:55',
    syncedToCloud: false,
  },
];

export default function AdminStaffDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Dashboard States
  const [photos, setPhotos] = useState<PhotoRecord[]>(INITIAL_PHOTOS);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | '5m' | '15m' | '1h'>('all');
  const [selectedPhotoForQR, setSelectedPhotoForQR] = useState<PhotoRecord | null>(null);
  const [kioskStatus, setKioskStatus] = useState<'IDLE_DETECTING' | 'COUNTDOWN' | 'PREVIEW' | 'PAUSED'>('IDLE_DETECTING');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Authentication
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234') {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  // Broadcast Commands to Kiosk Screen 1
  const sendKioskCommand = (cmd: string, label: string) => {
    const channel = new BroadcastChannel('swu_photobooth_bus');
    channel.postMessage({ type: cmd, timestamp: new Date().toISOString() });
    channel.close();

    if (cmd === 'FORCE_RESET') setKioskStatus('IDLE_DETECTING');
    if (cmd === 'PAUSE_TOGGLE') setKioskStatus((prev) => (prev === 'PAUSED' ? 'IDLE_DETECTING' : 'PAUSED'));

    setActionNotice(label);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleDeletePhoto = (code: string) => {
    if (confirm(`ยืนยันการลบรูปภาพ #${code} ตามข้อกำหนดสิทธิส่วนบุคคล PDPA ทันทีหรือไม่?`)) {
      setPhotos((prev) => prev.filter((p) => p.code !== code));
      setActionNotice(`ลบรูปภาพ #${code} ออกจากระบบเรียบร้อยแล้ว`);
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard?.writeText(url);
    setActionNotice('คัดลอกลิงก์รับรูปเรียบร้อยแล้ว');
    setTimeout(() => setActionNotice(null), 2500);
  };

  // Filter photos
  const filteredPhotos = photos.filter((p) => {
    const matchCode = p.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCode;
  });

  // Login Screen
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#06080D] text-white flex items-center justify-center p-6 select-none">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl border border-[#1E2536] bg-[#0D111A] p-8 shadow-2xl space-y-6 text-center"
        >
          <div className="mx-auto w-12 h-12 rounded-xl bg-[#CE1126]/10 border border-[#CE1126]/30 flex items-center justify-center text-xl text-[#CE1126] font-extrabold">
            CPE
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Staff Admin Portal</h1>
            <p className="text-xs text-[#8492A6] mt-1">SWU Open House AI Photo Booth Master Controller</p>
          </div>

          <div className="space-y-2">
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError(false);
              }}
              placeholder="Staff PIN (ค่าเริ่มต้น: 1234)"
              className={`w-full px-4 py-3 rounded-xl bg-[#06080D] border text-center font-mono text-xl tracking-widest text-white placeholder:text-xs placeholder:tracking-normal placeholder:text-slate-500 focus:outline-none transition-all ${
                pinError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-[#1E2536] focus:border-[#CE1126]'
              }`}
              maxLength={6}
              autoFocus
            />
            {pinError && <p className="text-xs text-red-400 font-medium">รหัส PIN ไม่ถูกต้อง (ทดลองใช้: 1234)</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#CE1126] hover:bg-[#E11D48] text-white font-semibold text-sm transition-all shadow-lg shadow-red-950/40"
          >
            เข้าสู่ระบบควบคุม
          </button>

          <div className="text-[11px] text-slate-500 pt-2 border-t border-[#1E2536]/60">
            🔒 เฉพาะสตาฟประจำซุ้มวิศวกรรมคอมพิวเตอร์ มศว
          </div>
        </form>
      </main>
    );
  }

  // Authenticated Staff Dashboard
  return (
    <main className="min-h-screen bg-[#06080D] text-white p-6 space-y-6 select-none font-sans">
      {/* 1. TOP APP BAR */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1E2536] bg-[#0D111A] px-6 py-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-8 h-8 rounded-lg bg-[#CE1126] flex items-center justify-center font-bold text-xs tracking-wider text-white">
            CPE
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Staff Master Dashboard</h1>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#10B981] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                ONLINE (LAPTOP)
              </span>
            </div>
            <p className="text-xs text-[#8492A6]">
              SWU Open House • ควบคุมและดูแล 2 หน้าจอแสดงผลแบบ Real-time
            </p>
          </div>
        </div>

        {/* Global Action Notices */}
        {actionNotice && (
          <div className="rounded-lg bg-[#2DD4BF]/15 border border-[#2DD4BF]/30 px-4 py-1.5 font-mono text-xs text-[#2DD4BF] animate-fade-in">
            ⚡ {actionNotice}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right font-mono text-xs text-slate-400">
            <span>Server IP: 192.168.1.10:3000</span>
            <span className="text-[10px] text-slate-500">WiFi: SWU-CPE-BOOTH-5G</span>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="rounded-xl border border-[#1E2536] bg-[#06080D] px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 transition-all"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      {/* 2. SYSTEM HEALTH TELEMETRY GRID (4 CARDS) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Camera & AI Vision */}
        <div className="rounded-xl border border-[#1E2536] bg-[#0D111A] p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>📷 กล้องและ Hand AI</span>
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          </div>
          <div className="my-2">
            <div className="text-lg font-bold text-white tracking-tight">1080p @ 60 FPS</div>
            <div className="text-xs text-[#2DD4BF] font-mono">MediaPipe WebGL: 12ms Latency</div>
          </div>
          <div className="text-[11px] text-slate-500">USB Webcam / จอ 1 Active</div>
        </div>

        {/* Card 2: Screen Bus Sync */}
        <div className="rounded-xl border border-[#1E2536] bg-[#0D111A] p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>📺 การเชื่อมต่อ 2 จอแสดงผล</span>
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          </div>
          <div className="my-2">
            <div className="text-lg font-bold text-white tracking-tight">BroadcastChannel 0ms</div>
            <div className="text-xs text-emerald-400 font-mono">Bus: swu_photobooth_bus</div>
          </div>
          <div className="text-[11px] text-slate-500">จอ 1 (Kiosk) ↔ จอ 2 (Showcase) ซิงค์เรียบร้อย</div>
        </div>

        {/* Card 3: Storage & Cloud Sync */}
        <div className="rounded-xl border border-[#1E2536] bg-[#0D111A] p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>💾 การจัดเก็บและสำรองข้อมูล</span>
            <span className="w-2 h-2 rounded-full bg-[#2DD4BF]" />
          </div>
          <div className="my-2">
            <div className="text-lg font-bold text-white tracking-tight">Local + R2 Backup</div>
            <div className="text-xs text-[#2DD4BF] font-mono">Synced: 98% (Pending: 1)</div>
          </div>
          <div className="text-[11px] text-slate-500">ความจุเครื่องคงเหลือ 214 GB</div>
        </div>

        {/* Card 4: Total Photos & PDPA Auto-Purge */}
        <div className="rounded-xl border border-[#1E2536] bg-[#0D111A] p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>🔒 รูปทั้งหมด & PDPA Retention</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="my-2">
            <div className="text-lg font-bold text-white tracking-tight">{photos.length} รูปในวันนี้</div>
            <div className="text-xs text-amber-400 font-mono">Auto-delete: 7 วัน (PDPA)</div>
          </div>
          <div className="text-[11px] text-slate-500">รูปเก่าสุดจะหมดอายุใน 6 วัน 22 ชม.</div>
        </div>
      </section>

      {/* 3. KIOSK QUICK CONTROLLER (จอที่ 1 Control Bar) */}
      <section className="rounded-2xl border border-[#1E2536] bg-[#0D111A] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white">🎮 สั่งการด่วนจอที่ 1 (Kiosk Remote):</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 font-mono text-xs text-slate-300">
              สถานะปัจจุบัน:{' '}
              <strong className="text-[#2DD4BF]">
                {kioskStatus === 'IDLE_DETECTING' && 'รอตรวจจับมือ (Standby)'}
                {kioskStatus === 'COUNTDOWN' && 'กำลังนับถอยหลัง 3..2..1'}
                {kioskStatus === 'PREVIEW' && 'พรีวิว 10 วินาที'}
                {kioskStatus === 'PAUSED' && 'พักระบบบูธชั่วคราว'}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => sendKioskCommand('FORCE_RESET', 'รีเซ็ตจอ 1 กลับสู่โหมด Standby เรียบร้อย')}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold text-white transition-all flex items-center gap-1.5"
            >
              🔄 รีเซ็ตจอ 1 (Force Standby)
            </button>
            <button
              onClick={() => sendKioskCommand('FORCE_CONFIRM', 'ส่งรูปข้ามไปจอ 2 (Showcase) ทันที')}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold text-white transition-all flex items-center gap-1.5"
            >
              ⏩ ข้าม Preview ส่งไปจอ 2 ทันที
            </button>
            <button
              onClick={() => sendKioskCommand('PAUSE_TOGGLE', kioskStatus === 'PAUSED' ? 'เปิดระบบบูธตามปกติ' : 'พักระบบบูธชั่วคราว')}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                kioskStatus === 'PAUSED'
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
              }`}
            >
              ⏸️ {kioskStatus === 'PAUSED' ? 'เปิดบูธตามปกติ' : 'พักบูธชั่วคราว (จัดคิว/เช็ดเลนส์)'}
            </button>
          </div>
        </div>
      </section>

      {/* 4. PHOTO MANAGEMENT & RE-ISSUE QR CONSOLE (Main Workspace) */}
      <section className="rounded-2xl border border-[#1E2536] bg-[#0D111A] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#1E2536]/60">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              📸 ค้นหารูปภาพและออก QR Code ย้อนหลัง (Re-issue QR)
            </h2>
            <p className="text-xs text-[#8492A6] mt-0.5">
              สำหรับกรณีที่น้องสแกนไม่ทัน ลืมสแกน หรือต้องการรับรูปรอบสอง
            </p>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารหัสรูป เช่น 8884 หรือ OPH-..."
              className="w-full sm:w-72 px-4 py-2 rounded-xl bg-[#06080D] border border-[#1E2536] font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2DD4BF] transition-all"
            />
          </div>
        </div>

        {/* Photos Grid Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredPhotos.map((photo) => (
            <div
              key={photo.code}
              className="rounded-xl border border-[#1E2536] bg-[#06080D] p-3.5 flex flex-col justify-between space-y-3 hover:border-slate-600 transition-all shadow-md group"
            >
              {/* Image Preview 4:3 */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-900 border border-white/5">
                <img
                  src={photo.photoUrl}
                  alt={`Photo #${photo.code}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute top-2 left-2 font-mono text-[10px] font-bold text-white bg-black/70 px-2 py-0.5 rounded backdrop-blur-xs">
                  #{photo.code}
                </span>
                <span className="absolute bottom-2 right-2 font-mono text-[9px] text-slate-300 bg-black/60 px-1.5 py-0.5 rounded">
                  {photo.capturedAt}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedPhotoForQR(photo)}
                  className="w-full py-2 px-3 rounded-lg bg-[#CE1126] hover:bg-[#E11D48] text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <span>📱</span> เปิด QR ให้น้องสแกน
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleCopyLink(photo.qrUrl)}
                    className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 transition-all text-center"
                  >
                    🔗 คัดลอกลิงก์
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(photo.code)}
                    className="py-1.5 px-2 rounded-lg bg-red-950/20 hover:bg-red-950/50 border border-red-500/20 text-[11px] text-red-400 transition-all text-center"
                  >
                    🗑️ ลบรูป (PDPA)
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredPhotos.length === 0 && (
          <div className="text-center py-12 text-slate-500 font-mono text-xs">
            ไม่พบรูปภาพที่ตรงกับเงื่อนไขการค้นหา "{searchQuery}"
          </div>
        )}
      </section>

      {/* 5. RE-ISSUE QR CODE MODAL OVERLAY */}
      {selectedPhotoForQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#1E2536] bg-[#0D111A] p-7 shadow-2xl text-center space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2536]">
              <div className="text-left">
                <span className="font-mono text-xs font-semibold text-[#2DD4BF] uppercase">
                  RE-ISSUE QR CODE
                </span>
                <h3 className="text-lg font-bold text-white">สแกนรับรูปถ่ายของคุณ</h3>
              </div>
              <button
                onClick={() => setSelectedPhotoForQR(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* High Contrast QR Code Card */}
            <div className="mx-auto aspect-square w-64 rounded-2xl bg-white p-5 shadow-2xl flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                  selectedPhotoForQR.qrUrl
                )}`}
                alt="QR Code"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-400 font-mono">รหัสรูปภาพ (Photo Code)</div>
              <div className="text-3xl font-mono font-extrabold text-[#CE1126] tracking-widest">
                #{selectedPhotoForQR.code}
              </div>
              <p className="text-xs text-slate-400 pt-1">
                ให้น้องใช้กล้องมือถือสแกนบนหน้าจอ Laptop นี้ได้ทันที
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedPhotoForQR(null)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-all"
              >
                ปิดหน้าต่าง (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
