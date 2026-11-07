import Link from 'next/link';
import {
  Camera,
  Monitor,
  Sliders,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#1C1F26] text-[#F8FAFC] flex flex-col justify-between p-6 md:p-12 font-sans select-none overflow-x-hidden">
      {/* Background Engineering Grid & Ambient Glows */}
      <div className="pointer-events-none absolute inset-0 engineering-grid opacity-60" />
      <div className="pointer-events-none absolute -top-40 -left-40 size-[32rem] rounded-full bg-[#CE1126]/10 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[32rem] rounded-full bg-[#06B6D4]/10 blur-[130px]" />

      {/* Top Brand Banner */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between border-b border-[#373D4B] pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#CE1126] font-black text-white text-base shadow-[0_0_20px_rgba(206,17,38,0.4)] border border-white/10">
            CPE
          </div>
          <div>
            <div className="mono text-[10px] tracking-[.18em] text-[#CE1126] font-bold uppercase">
              SRINAKHARINWIROT UNIVERSITY • FACULTY OF ENGINEERING
            </div>
            <div className="text-lg font-black text-white tracking-tight">
              CPE PhotoBooth <span className="text-slate-500 font-normal">|</span> Open House 2026
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 backdrop-blur-md">
          <span className="size-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="mono text-xs font-semibold text-emerald-400 tracking-wider">
            SYSTEM READY · DUAL-SCREEN ACTIVE
          </span>
        </div>
      </header>

      {/* Main Hub Presentation */}
      <section className="relative z-10 w-full max-w-6xl mx-auto my-auto py-12 space-y-12">
        {/* Hero Title */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-cyan-300 uppercase mono">
            <Cpu className="size-3.5 text-cyan-400" />
            TOUCHLESS AI VISION CONTROL SUITE
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
            CPE PhotoBooth
          </h1>
          <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">
            ระบบตู้ถ่ายภาพอัจฉริยะไร้สัมผัส 1 Laptop ควบคุม 2 จอแสดงผลภายนอก เชื่อมต่อเรียลไทม์ผ่าน BroadcastChannel
          </p>
        </div>

        {/* 4 Screen Launcher Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Screen 1 Kiosk */}
          <Link
            href="/kiosk"
            target="_blank"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#242832]/90 border border-[#373D4B] hover:border-[#CE1126] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(206,17,38,0.2)] backdrop-blur-md"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#CE1126]/15 border border-[#CE1126]/30 text-[#CE1126] shadow-inner group-hover:scale-105 transition-transform">
                  <Camera className="size-5" strokeWidth={1.8} />
                </div>
                <span className="mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#CE1126]/15 text-[#CE1126] font-bold border border-[#CE1126]/30">
                  DISPLAY 1
                </span>
              </div>

              <div>
                <div className="mono text-[11px] text-slate-400 font-bold mb-1">
                  /kiosk
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-[#CE1126] transition-colors leading-snug">
                  ตู้ถ่ายรูปไร้สัมผัส
                </h2>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                จอ 16:9 ไกด์ 4:3 แบมือ 1.5 วินาทีเพื่อเริ่มถ่าย นับถอยหลัง 3..2..1 ชัตเตอร์แฟลช 150ms และพรีวิว 10 วินาที ไร้สัมผัส 100%
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#373D4B]/60 flex items-center justify-between text-xs font-bold text-[#CE1126]">
              <span>เปิดหน้าตู้ถ่ายรูป</span>
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Screen 2 Showcase */}
          <Link
            href="/display"
            target="_blank"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#242832]/90 border border-[#373D4B] hover:border-[#06B6D4] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(6,182,212,0.2)] backdrop-blur-md"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-[#06B6D4] shadow-inner group-hover:scale-105 transition-transform">
                  <Monitor className="size-5" strokeWidth={1.8} />
                </div>
                <span className="mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#06B6D4]/15 text-[#06B6D4] font-bold border border-[#06B6D4]/30">
                  DISPLAY 2
                </span>
              </div>

              <div>
                <div className="mono text-[11px] text-slate-400 font-bold mb-1">
                  /display
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-[#06B6D4] transition-colors leading-snug">
                  Showcase & QR
                </h2>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                แบ่งสัดส่วน 30/70 ซ้าย 30% สถานีสแกนรับรูป QR Code ความคมชัดสูง ขวา 70% Live Photo Wall แสดงภาพรวมแบบเรียลไทม์
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#373D4B]/60 flex items-center justify-between text-xs font-bold text-[#06B6D4]">
              <span>เปิดหน้า Showcase</span>
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Laptop Admin Portal */}
          <Link
            href="/admin"
            target="_blank"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#242832]/90 border border-[#373D4B] hover:border-[#38BDF8] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(56,189,248,0.2)] backdrop-blur-md"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/30 text-[#38BDF8] shadow-inner group-hover:scale-105 transition-transform">
                  <Sliders className="size-5" strokeWidth={1.8} />
                </div>
                <span className="mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#38BDF8]/15 text-[#38BDF8] font-bold border border-[#38BDF8]/30">
                  STAFF CONSOLE
                </span>
              </div>

              <div>
                <div className="mono text-[11px] text-slate-400 font-bold mb-1">
                  /admin
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-[#38BDF8] transition-colors leading-snug">
                  แดชบอร์ดสตาฟ
                </h2>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                ระบบรักษาความปลอดภัย PIN Gate (1234), เทเลเมตรีฮาร์ดแวร์, ปุ่มลบรูปตาม PDPA, ควบคุม Kiosk ฉุกเฉิน และ Re-issue QR
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#373D4B]/60 flex items-center justify-between text-xs font-bold text-[#38BDF8]">
              <span>เปิดแดชบอร์ดสตาฟ</span>
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 4: Mobile App */}
          <Link
            href="/p/OPH-SWU1"
            target="_blank"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[#242832]/90 border border-[#373D4B] hover:border-[#F59E0B] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(245,158,11,0.2)] backdrop-blur-md"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] shadow-inner group-hover:scale-105 transition-transform">
                  <Smartphone className="size-5" strokeWidth={1.8} />
                </div>
                <span className="mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#F59E0B]/15 text-[#F59E0B] font-bold border border-[#F59E0B]/30">
                  MOBILE WEB
                </span>
              </div>

              <div>
                <div className="mono text-[11px] text-slate-400 font-bold mb-1">
                  /p/[code]
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-[#F59E0B] transition-colors leading-snug">
                  เว็บดาวน์โหลด & แต่งรูป
                </h2>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                เว็บดาวน์โหลดรูปผ่าน 4G/5G ด้วย Canvas Editor แต่งฟิลเตอร์ 6 พรีเซ็ต ปรับแสง และใส่กรอบลายวิศวะ SWU บันทึกลงเครื่องทันที
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#373D4B]/60 flex items-center justify-between text-xs font-bold text-[#F59E0B]">
              <span>ทดสอบเว็บบนมือถือ</span>
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto border-t border-[#1E2536] pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-400" />
          <span>ภาควิชาวิศวกรรมคอมพิวเตอร์ คณะวิศวกรรมศาสตร์ มหาวิทยาลัยศรีนครินทรวิโรฒ • Open House 2026</span>
        </div>
        <div className="mt-2 md:mt-0 mono text-[11px] text-slate-400">
          Compliant with PDPA (7-Day TTL) • Impeccable Tech Craft
        </div>
      </footer>
    </main>
  );
}
