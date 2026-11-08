'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { CpeLogo } from './CpeLogo';

export function StaffGate({
  title = 'Staff Security Gate',
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  // Check existing session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAuth = sessionStorage.getItem('swu_admin_auth');
      if (savedAuth === 'true') {
        setIsAuthenticated(true);
      }
      setIsChecking(false);
    }
  }, []);

  const handlePinSubmit = (val: string) => {
    if (val === '1234') {
      setIsAuthenticated(true);
      setPinError(false);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('swu_admin_auth', 'true');
      }
    } else {
      setPinError(true);
      setPin('');
      setTimeout(() => setPinError(false), 1200);
    }
  };

  // Physical Keyboard Listener
  useEffect(() => {
    if (isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        e.preventDefault();
        setPin((prev) => {
          if (prev.length < 4) {
            const next = prev + e.key;
            if (next.length === 4) {
              handlePinSubmit(next);
            }
            return next;
          }
          return prev;
        });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pin.length === 4) {
          handlePinSubmit(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, pin]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#07080B] flex items-center justify-center font-['Prompt'] text-slate-400">
        <span className="font-mono text-xs">Authenticating staff session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen bg-[#07080B] flex items-center justify-center p-4 font-['Prompt'] select-none overflow-hidden">
        {/* Engineering Background Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-600/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="relative z-10 w-full max-w-sm p-8 rounded-3xl bg-[#0F1117]/95 border border-white/10 text-center shadow-2xl backdrop-blur-xl">
          {/* Logo & Shield Icon */}
          <div className="flex justify-center mb-5">
            <CpeLogo className="h-9" />
          </div>

          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <Lock className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold text-white font-['Kanit'] tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            กรุณาระบุรหัส PIN 4 หลักเพื่อเข้าสู่แดชบอร์ดสตาฟฟ์
          </p>

          {/* 4-Digit Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-12 h-14 rounded-xl border flex items-center justify-center text-xl font-bold font-['JetBrains_Mono'] transition-all ${
                  pinError
                    ? 'border-red-500 bg-red-500/10 text-red-500 animate-pulse'
                    : pin.length > i
                    ? 'border-blue-500 bg-blue-500/10 text-white shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                    : 'border-white/10 bg-white/[0.02] text-slate-600'
                }`}
              >
                {pin.length > i ? '•' : ''}
              </div>
            ))}
          </div>

          {/* Error Message */}
          {pinError && (
            <div className="text-[11px] font-mono font-bold text-red-400 mb-4 animate-in fade-in">
              รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง
            </div>
          )}

          {/* 3x4 Tactile Numpad */}
          <div className="grid grid-cols-3 gap-2.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((item) => (
              <button
                key={item}
                onClick={() => {
                  if (item === 'C') {
                    setPin('');
                    setPinError(false);
                  } else if (item === 'OK') {
                    handlePinSubmit(pin);
                  } else if (pin.length < 4) {
                    const next = pin + item;
                    setPin(next);
                    if (next.length === 4) handlePinSubmit(next);
                  }
                }}
                className={`h-12 rounded-xl font-['JetBrains_Mono'] font-bold text-lg border transition-all cursor-pointer ${
                  item === 'OK'
                    ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/50 shadow-md'
                    : item === 'C'
                    ? 'bg-white/[0.02] hover:bg-red-500/10 text-red-400 border-white/[0.06] hover:border-red-500/30'
                    : 'bg-white/[0.03] hover:bg-white/[0.08] active:bg-blue-600 text-white border-white/[0.06]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-6 text-[10px] text-slate-500 font-['JetBrains_Mono']">
            Staff Pin Default: [1234] • Keyboard & Numpad Supported
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
