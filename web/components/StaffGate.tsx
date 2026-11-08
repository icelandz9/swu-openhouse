'use client';

// Locks a staff-only screen (/admin) until this browser is unlocked with the staff PIN.
// The session is a cookie, so unlocking once covers every tab of the same browser.
import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { CpeLogo } from '@/components/CpeLogo';

type GateState = 'checking' | 'locked' | 'open';

export function StaffGate({ title, children }: { title: string; children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => {
        if (data?.configError) setError(data.configError);
        setState(data?.staff ? 'open' : 'locked');
      })
      .catch(() => setState('locked'));
  }, []);

  if (state === 'open') return <>{children}</>;
  if (state === 'checking') return <main className="min-h-dvh bg-black" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState('open');
      } else {
        setError(data?.error || 'ปลดล็อกไม่สำเร็จ');
        setPin('');
      }
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-black p-6 text-white select-none">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-6 rounded-2xl border border-[#1C1C1C] bg-[#0A0A0A] p-8 text-center shadow-2xl"
      >
        <CpeLogo className="mx-auto h-10" />
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[#CE1126]/40 bg-[#CE1126]/20 text-[#CE1126]">
          <Lock className="size-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="mt-1 text-xs text-slate-400">สำหรับสตาฟ กรอก PIN เพื่อเปิดหน้านี้</p>
        </div>
        <div className="relative">
          <input
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="h-12 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-12 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none focus:border-[#CE1126]"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPin((v) => !v)}
            aria-label={showPin ? 'ซ่อน PIN' : 'แสดง PIN'}
            aria-pressed={showPin}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition-colors hover:text-white"
          >
            {showPin ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !pin}
          className="h-11 w-full rounded-xl bg-[#CE1126] text-sm font-bold text-white transition-colors hover:bg-[#e1132b] disabled:opacity-50"
        >
          {submitting ? 'กำลังตรวจสอบ...' : 'ปลดล็อก'}
        </button>
      </form>
    </main>
  );
}
