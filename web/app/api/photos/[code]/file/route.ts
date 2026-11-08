import { NextRequest, NextResponse } from 'next/server';
import { photoStorageService } from '@/lib/storage/storageService';
import { isValidShortCode } from '@/lib/mobile/shortCodeGenerator';
import { verifyPhotoToken, verifyPhotoClaimSecret } from '@/lib/security/photoToken';
import { isStaffRequest } from '@/lib/auth/staffSession';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const normCode = code.toUpperCase();

    if (!isValidShortCode(normCode)) {
      return NextResponse.json(
        { error: 'Invalid short code format' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // High-security photo file authorization check
    const token = req.nextUrl.searchParams.get('t');
    const cookieName = `booth_claim_${normCode.replace(/[^A-Z0-9]/g, '_')}`;
    const claimCookie = req.cookies.get(cookieName)?.value;
    const isStaff = isStaffRequest(req);
    const host = req.headers.get('host') || '';
    const isLocalKiosk = host.startsWith('localhost') || host.startsWith('127.0.0.1');

    const isAuthorized =
      isLocalKiosk ||
      isStaff ||
      (token && verifyPhotoToken(normCode, token)) ||
      (claimCookie && verifyPhotoClaimSecret(normCode, claimCookie));

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden: Valid scan token or authorized session required' },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const buffer = await photoStorageService.getPhotoBuffer(normCode);
    if (!buffer) {
      return NextResponse.json(
        { error: 'Photo not found or expired' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=86400',
        ...CORS_HEADERS,
      },
    });
  } catch (error: any) {
    console.error('Error serving photo file:', error);
    return NextResponse.json(
      { error: 'Internal server error while serving photo' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
