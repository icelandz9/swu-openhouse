import { NextRequest, NextResponse } from 'next/server';
import { photoStorageService } from '@/lib/storage/storageService';
import { isValidShortCode } from '@/lib/mobile/shortCodeGenerator';
import { requireStaff } from '@/lib/auth/requireStaff';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!isValidShortCode(code)) {
      return NextResponse.json(
        { error: 'Invalid short code format' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const photoUrl = await photoStorageService.getPhotoUrl(code);
    if (!photoUrl) {
      return NextResponse.json(
        { error: 'Photo not found or expired' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        code,
        photoUrl,
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
    const { code } = await params;

    if (!isValidShortCode(code)) {
      return NextResponse.json(
        { error: 'Invalid short code format' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const success = await photoStorageService.deletePhoto(code);
    return NextResponse.json(
      { success, code },
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
