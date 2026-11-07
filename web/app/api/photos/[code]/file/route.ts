import { NextRequest, NextResponse } from 'next/server';
import { photoStorageService } from '@/lib/storage/storageService';
import { isValidShortCode } from '@/lib/mobile/shortCodeGenerator';

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

    const buffer = await photoStorageService.getPhotoBuffer(code);
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
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        ...CORS_HEADERS,
      },
    });
  } catch (error: any) {
    console.error('Error serving photo file:', error);
    return NextResponse.json(
      { error: 'Internal server error while serving photo file' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
