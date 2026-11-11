'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error Boundary]:', error);
  }, [error]);

  return (
    <html lang="th">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">ข้อผิดพลาดระดับระบบ (Critical System Issue)</h2>
          <p className="text-sm text-slate-400 mb-6">
            ระบบตรวจพบข้อผิดพลาดที่ไม่คาดคิด กรุณากดปุ่มรีสตาร์ตเพื่อเริ่มทำงานใหม่
          </p>
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            รีสตาร์ตระบบ (Restart)
          </button>
        </div>
      </body>
    </html>
  );
}
