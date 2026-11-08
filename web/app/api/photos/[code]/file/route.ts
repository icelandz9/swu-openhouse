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

// Public file access enabled by short code

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
