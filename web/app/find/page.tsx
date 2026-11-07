'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, ShieldCheck, ArrowLeft } from 'lucide-react';
import { CpeLogo } from '@/components/CpeLogo';

export default function FindPhotoPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{4}$/.test(normalized)) {
      setError('กรุณากรอกรหัส 4 หลัก (ไม่ใช้ 0, O, 1, I, L)');
      return;
    }
    window.location.href = `/p/OPH-${normalized}`;
  };

  return (
    <main className="mobile-app-shell mx-auto grid min-h-dvh w-full max-w-[390px] place-items-center bg-black px-6 text-slate-200 select-none">
      <div className="w-full">
        <CpeLogo className="mb-8 h-12" />
        <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-[-.04em] text-white">
          ค้นหารูปถ่าย
          <br />
          ของคุณ
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          กรอกรหัสที่แสดงบนจอรับรูป เพื่อกลับไปแต่งและดาวน์โหลดภาพถ่ายของคุณ
        </p>

        <form onSubmit={handleSearch} className="mt-8">
          <label htmlFor="photo-code" className="text-xs font-bold text-slate-300">
            รหัสรูปถ่าย
          </label>
          <div className="mt-2 flex h-16 items-center rounded-xl border border-white/10 bg-[#0A0A0A] px-4 focus-within:border-cyan-400/60 shadow-inner">
            <span className="mono text-lg font-semibold tracking-[.12em] text-slate-500">OPH-</span>
            <input
              id="photo-code"
              value={code}
              onChange={(e) => {
                const raw = e.target.value.toUpperCase();
                const stripped = raw.replace(/^OPH-?/, '').replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 4);
                setCode(stripped);
                setError('');
              }}
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              maxLength={4}
              placeholder="AB29"
              className="mono min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-[.2em] text-white outline-none placeholder:text-slate-700"
              autoFocus
            />
            <span className="mono text-xs text-slate-600">{code.length}/4</span>
          </div>
          {error && <p className="mt-2 text-xs text-[#F87171]">{error}</p>}
          <button
            type="submit"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#CE1126] hover:bg-[#e1132b] text-sm font-bold text-white transition-colors shadow-lg"
          >
            <Search className="size-4" /> ค้นหารูปทันที
          </button>
        </form>

        <div className="mt-8 flex items-start gap-3 border-t border-white/[.07] pt-5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          <p className="text-[10px] leading-relaxed text-slate-500">
            ระบบเก็บรักษาภาพเป็นเวลา 7 วันตามนโยบาย PDPA หลังจากนั้นภาพจะถูกลบโดยอัตโนมัติและไม่สามารถกู้คืนได้
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-3.5" /> กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </main>
  );
}
