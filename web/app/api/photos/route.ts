import { NextRequest, NextResponse } from 'next/server';
import { photoStorageService } from '@/lib/storage/storageService';
import { generateShortCode, isValidShortCode } from '@/lib/mobile/shortCodeGenerator';
import { UploadPhotoResponse } from '@/lib/contracts';
import { requireStaff } from '@/lib/auth/requireStaff';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// Staff only: the list holds every attendee's code, so it must not be public (PDPA).
export async function GET(req: NextRequest) {
  const denied = requireStaff(req, CORS_HEADERS);
  if (denied) return denied;
  try {
    const photos = await photoStorageService.getAllPhotos();
    return NextResponse.json(
      {
        success: true,
        count: photos.length,
        photos,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching photos' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Staff only: uploads come from the unlocked kiosk browser.
export async function POST(req: NextRequest) {
  const denied = requireStaff(req, CORS_HEADERS);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { imageBase64, code: requestedCode } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Invalid payload: imageBase64 is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Strip data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Use requested code if valid to maintain 100% sync across screens, or generate new
    let shortCode =
      requestedCode && isValidShortCode(requestedCode)
        ? requestedCode.trim().toUpperCase()
        : generateShortCode();
    // Never overwrite someone else's photo: pick a new code while this one is taken.
    for (let attempt = 0; attempt < 5 && (await photoStorageService.getPhotoUrl(shortCode)); attempt++) {
      shortCode = generateShortCode();
    }

    const stored = await photoStorageService.savePhoto(shortCode, buffer);

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const qrUrl = `${protocol}://${host}/p/${shortCode}`;

    const responsePayload: UploadPhotoResponse = {
      code: shortCode,
      qrUrl,
      photoUrl: stored.url,
      createdAt: new Date().toISOString(),
      expiresAt: stored.expiresAt,
    };

    return NextResponse.json(responsePayload, {
      status: 201,
      headers: CORS_HEADERS,
    });
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { error: 'Internal server error while saving photo' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
