import { Metadata } from 'next';

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `รูปถ่ายของคุณ [${code}] | SWU Open House CPE`,
    description: 'เลือกฟิลเตอร์และกรอบรูป มศว ได้ตามใจชอบ แล้วดาวน์โหลดลงมือถือ',
  };
}

export default async function MobilePhotoPage({ params }: Props) {
  const { code } = await params;

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-4">
      {/* Top Banner showing OPH-XXXX code */}
      <header className="w-full max-w-md py-3 px-4 bg-red-700 rounded-lg text-center shadow-lg mb-6">
        <h1 className="text-xl font-bold tracking-widest">{code}</h1>
        <p className="text-xs text-red-100">ภาพจะถูกลบอัตโนมัติภายใน 7 วันตามกฎหมาย PDPA</p>
      </header>

      <div className="w-full max-w-md aspect-[4/3] bg-neutral-800 rounded-lg border border-neutral-700 flex items-center justify-center">
        <p className="text-sm text-neutral-400">
          Mobile Canvas 2D Editor & CPE 4:3 Frames Placeholder
        </p>
      </div>
    </main>
  );
}
