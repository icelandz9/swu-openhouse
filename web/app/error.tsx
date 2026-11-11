'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Home, Trash2 } from 'lucide-react';

export default function ErrorBoundaryPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log error to console for staff triage
    console.error('[App Error Boundary Caught]:', error);
  }, [error]);

  const handleClearCacheAndReset = () => {
    if (typeof window !== 'undefined') {
      try {
        // Clear potentially conflicting session states
        sessionStorage.clear();
      } catch {}
      window.location.href = '/launchpad';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-none font-sans">
      <div className="w-full max-w-lg bg-slate-900 border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-red-950/40 text-center backdrop-blur-xl">
        {/* Icon & Badge */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-5 shadow-inner">
          <AlertTriangle className="w-8 h-8 animate-pulse text-red-500" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          พบข้อขัดข้องชั่วคราว (Auto-Recovery)
        </h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          ระบบป้องกันข้อผิดพลาดอัตโนมัติทำงานเพื่อรักษาความเสถียรของตู้ถ่ายรูป
          กรุณากดปุ่มกู้คืนด้านล่างเพื่อกลับสู่การทำงานปกติ
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-medium text-sm transition-all shadow-lg shadow-red-600/30 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            กู้คืนระบบ (Try Again)
          </button>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/launchpad';
              }
            }}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-medium text-sm transition-all border border-slate-700 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            กลับหน้า Launchpad
          </button>
        </div>

        {/* Secondary recovery option */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-2">
          <button
            onClick={handleClearCacheAndReset}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors py-1"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            ล้างเซสชันชั่วคราวและรีสตาร์ต
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors py-1"
          >
            {showDetails ? 'ซ่อนข้อมูลเชิงเทคนิค' : 'แสดงข้อมูลวิเคราะห์สำหรับทีมงาน (Staff)'}
          </button>
        </div>

        {/* Diagnostic details */}
        {showDetails && (
          <div className="mt-4 p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-left overflow-x-auto text-[11px] font-mono text-red-300 max-h-40">
            <div className="text-slate-400 font-semibold mb-1">
              Message: {error.message || 'Unknown runtime error'}
            </div>
            {error.digest && (
              <div className="text-slate-500 text-[10px] mb-1">Digest: {error.digest}</div>
            )}
            {error.stack && (
              <pre className="text-slate-500 text-[10px] whitespace-pre-wrap">{error.stack}</pre>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-slate-600">
        CPE SWU Open House PhotoBooth • Self-Healing Architecture
      </div>
    </div>
  );
}
