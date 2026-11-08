import { NextRequest, NextResponse } from 'next/server';
import { photoStorageService } from '@/lib/storage/storageService';
import { isValidShortCode } from '@/lib/mobile/shortCodeGenerator';
import { requireStaff } from '@/lib/auth/requireStaff';
import { verifyPhotoToken, verifyPhotoClaimSecret } from '@/lib/security/photoToken';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const { code: rawCode } = await params;
    const code = decodeURIComponent(rawCode).toUpperCase();
    const normalizedCode = code.startsWith('OPH-') ? code : `OPH-${code}`;

    if (!isValidShortCode(normalizedCode)) {
      return NextResponse.json(
        { error: 'Invalid short code format' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

// Public attendee photo access enabled by short code

    const photoUrl = await photoStorageService.getPhotoUrl(normalizedCode);
    if (!photoUrl) {
      return NextResponse.json(
        { error: 'Photo not found or expired' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        code: normalizedCode,
        photoUrl,
        authorized: true,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('Error retrieving photo:', error);
    return NextResponse.json(
      { error: 'Internal server error while retrieving photo' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Staff only.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const denied = requireStaff(req, CORS_HEADERS);
  if (denied) return denied;
  try {
    const { code: rawCode } = await params;
    const code = decodeURIComponent(rawCode).toUpperCase();
    const normalizedCode = code.startsWith('OPH-') ? code : `OPH-${code}`;

    if (!isValidShortCode(normalizedCode)) {
      return NextResponse.json(
        { error: 'Invalid short code format' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const success = await photoStorageService.deletePhoto(normalizedCode);
    return NextResponse.json(
      { success, code: normalizedCode },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('Error deleting photo:', error);
    return NextResponse.json(
      { error: 'Internal server error while deleting photo' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
