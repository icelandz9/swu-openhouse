import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#06080D] text-[#F8FAFC] flex flex-col items-center justify-between p-6 md:p-12 font-sans select-none">
      {/* Top Brand Banner */}
      <div className="w-full max-w-5xl flex items-center justify-between border-b border-[#1E2536] pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CE1126] font-bold text-white shadow-lg">
            CPE
          </div>
          <div>
            <div className="text-[11px] font-mono tracking-widest text-[#CE1126] font-bold uppercase">
              SRINAKHARINWIROT UNIVERSITY
            </div>
            <div className="text-lg font-black text-white">
              CPE PhotoBooth • Open House 2026
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-xs font-mono text-[#94A3B8]">SYSTEM READY</span>
        </div>
      </div>

      {/* Main Hub Presentation */}
      <div className="w-full max-w-5xl my-auto py-12 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white">
            CPE PhotoBooth
          </h1>
        </div>

        {/* 4 Screen Launcher Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Screen 1 Kiosk */}
          <Link
            href="/kiosk"
            target="_blank"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#0D111A] border border-[#1E2536] hover:border-[#CE1126] transition-all hover:scale-[1.02] shadow-xl"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">📸</span>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#CE1126]/20 text-[#CE1126] font-bold border border-[#CE1126]/40">
                  DISPLAY 1
                </span>
              </div>
              <h2 className="text-lg font-bold text-white group-hover:text-[#CE1126] transition-colors">
                Screen 1: ตู้ถ่ายรูป (/kiosk)
              </h2>
              <p className="text-xs text-[#8492A6] leading-relaxed">
                จอ 16:9 ไกด์ 4:3 แบมือ 1.5s เริ่มถ่าย, นับถอยหลัง 3..2..1, ชัตเตอร์แฟลช 150ms และพรีวิว 10s (ไร้สัมผัส 100%)
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-[#CE1126]">
              เปิดหน้าตู้ถ่ายรูป →
            </div>
          </Link>

          {/* Card 2: Screen 2 Showcase */}
          <Link
            href="/display"
            target="_blank"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#0D111A] border border-[#1E2536] hover:border-[#10B981] transition-all hover:scale-[1.02] shadow-xl"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🖼️</span>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold border border-[#10B981]/40">
                  DISPLAY 2
                </span>
              </div>
              <h2 className="text-lg font-bold text-white group-hover:text-[#10B981] transition-colors">
                Screen 2: Showcase (/display)
              </h2>
              <p className="text-xs text-[#8492A6] leading-relaxed">
                แบ่งสัดส่วน 30/70 (ซ้าย 30% QR Code Station สำหรับสแกนรับรูป, ขวา 70% Live Photo Wall รวมรูป 4:3 สด)
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-[#10B981]">
              เปิดหน้าแสดงผล Showcase →
            </div>
          </Link>

          {/* Card 3: Laptop Admin Portal */}
          <Link
            href="/admin"
            target="_blank"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#0D111A] border border-[#1E2536] hover:border-[#06B6D4] transition-all hover:scale-[1.02] shadow-xl"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">💻</span>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#06B6D4]/20 text-[#06B6D4] font-bold border border-[#06B6D4]/40">
                  STAFF LAPTOP
                </span>
              </div>
              <h2 className="text-lg font-bold text-white group-hover:text-[#06B6D4] transition-colors">
                Admin: แดชบอร์ดสตาฟ (/admin)
              </h2>
              <p className="text-xs text-[#8492A6] leading-relaxed">
                PIN Gate (1234), เทเลเมตรีฮาร์ดแวร์, ควบคุม Kiosk ฉุกเฉิน, และ Re-issue QR ให้น้องที่ทำรหัสหาย
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-[#06B6D4]">
              เปิดแดชบอร์ดสตาฟ →
            </div>
          </Link>

          {/* Card 4: Mobile App */}
          <Link
            href="/p/OPH-SWU1"
            target="_blank"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#0D111A] border border-[#1E2536] hover:border-[#F59E0B] transition-all hover:scale-[1.02] shadow-xl"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">📱</span>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-bold border border-[#F59E0B]/40">
                  MOBILE WEB
                </span>
              </div>
              <h2 className="text-lg font-bold text-white group-hover:text-[#F59E0B] transition-colors">
                Mobile: แต่งรูป (/p/[code])
              </h2>
              <p className="text-xs text-[#8492A6] leading-relaxed">
                Canvas 2D Editor แต่งฟิลเตอร์ 6 พรีเซ็ต ปรับความสว่าง ใส่กรอบ CPE SWU 3 แบบ บันทึกรูปลง Camera Roll ทันที
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-bold text-[#F59E0B]">
              ทดสอบเว็บบนมือถือ →
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-5xl border-t border-[#1E2536] pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-[#8492A6]">
        <div>ภาควิชาวิศวกรรมคอมพิวเตอร์ มหาวิทยาลัยศรีนครินทรวิโรฒ • Open House 2026</div>
        <div className="mt-2 md:mt-0 font-mono text-[11px]">
          Compliant with PDPA (7-Day TTL) • Impeccable Tech Craft
        </div>
      </footer>
    </main>
  );
}
