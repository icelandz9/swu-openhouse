import Link from "next/link";

export default function Home() {
  return (
    <main className="home">
      <h1>
        <span>SWU</span> Open House Photo Booth
      </h1>
      <p>ระบบถ่ายรูปด้วยท่ามือ สแกน QR รับรูป แต่งฟิลเตอร์และกรอบบนมือถือ</p>
      <div className="home-links">
        <Link className="btn btn-primary" href="/kiosk">
          เปิดหน้าตู้ (Kiosk)
        </Link>
      </div>
    </main>
  );
}
