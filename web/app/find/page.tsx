'use client';

import { useState } from 'react';

export default function FindPhotoPage() {
  const [code, setCode] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode) {
      window.location.href = `/p/${cleanCode}`;
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl text-center">
        <h1 className="text-xl font-bold text-red-500 mb-2">ค้นหารูปถ่าย Open House</h1>
        <p className="text-xs text-neutral-400 mb-6">
          กรอกรหัส 4 หลักที่แสดงบนหน้าจอตู้ (เช่น OPH-AB29)
        </p>

        <form onSubmit={handleSearch} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="OPH-XXXX"
            className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-700 text-center font-mono text-lg tracking-widest text-white focus:outline-none focus:border-red-500"
            maxLength={8}
          />
          <button
            type="submit"
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition"
          >
            ค้นหารูปถ่าย
          </button>
        </form>
      </div>
    </main>
  );
}
