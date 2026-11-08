import { NextRequest, NextResponse } from 'next/server';
import { isValidShortCode } from '@/lib/mobile/shortCodeGenerator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).toUpperCase();
  const normalizedCode = code.startsWith('OPH-') ? code : `OPH-${code}`;

  if (!isValidShortCode(normalizedCode)) {
    return NextResponse.json({ authorized: false, error: 'Invalid photo code' }, { status: 400 });
  }

  return NextResponse.json({ authorized: true, code: normalizedCode, via: 'public' });
}
