'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234') { // Default staff PIN for prototype
      setIsAuthenticated(true);
    } else {
      alert('PIN ไม่ถูกต้อง');
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-xs bg-neutral-900 border border-neutral-800 p-6 rounded-xl text-center space-y-4">
          <h1 className="text-lg font-bold text-red-500">Staff Admin Login</h1>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Staff PIN"
            className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded text-center text-xl font-mono text-white focus:outline-none focus:border-red-500"
            maxLength={6}
          />
          <button type="submit" className="w-full py-2 bg-red-600 rounded text-white font-semibold">
            เข้าสู่ระบบ
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <header className="flex justify-between items-center border-b border-neutral-800 pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-red-500">Staff Portal (View All Photos & Re-issue QR)</h1>
          <p className="text-xs text-neutral-400">ภาพจะถูกลบอัตโนมัติเมื่อครบ 7 วัน (PDPA Compliance)</p>
        </div>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="text-xs bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded text-neutral-300"
        >
          ออกจากระบบ
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-dashed border-neutral-800 rounded-lg p-6 text-center text-neutral-500 text-sm">
          No photos uploaded yet
        </div>
      </div>
    </main>
  );
}
