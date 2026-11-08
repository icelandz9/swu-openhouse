import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPhotoToken,
  generatePhotoClaimSecret,
  verifyPhotoClaimSecret,
} from '@/lib/security/photoToken';
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

  const token = req.nextUrl.searchParams.get('t');
  const cookieName = `booth_claim_${normalizedCode.replace(/[^A-Z0-9]/g, '_')}`;
  const existingCookie = req.cookies.get(cookieName)?.value;

  // 1. Check existing device claim cookie (Valid for 7 days)
  if (existingCookie && verifyPhotoClaimSecret(normalizedCode, existingCookie)) {
    return NextResponse.json({ authorized: true, code: normalizedCode, via: 'cookie' });
  }

  // 2. Check signed cryptographic token from QR code
  if (token && verifyPhotoToken(normalizedCode, token)) {
    const claimSecret = generatePhotoClaimSecret(normalizedCode);
    const response = NextResponse.json({ authorized: true, code: normalizedCode, via: 'token' });

    // Set 7-day device claim cookie
    response.cookies.set(cookieName, claimSecret, {
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'lax',
      httpOnly: false, // Accessible to client for instant verification
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  }

  // 3. Unauthorized access attempt (IDOR attack or missing token)
  return NextResponse.json(
    {
      authorized: false,
      error: 'Unauthorized: A valid QR code scan token is required to view this photo',
    },
    { status: 403 }
  );
}
