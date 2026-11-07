import { NextRequest, NextResponse } from 'next/server';
import { photoStorageService } from '@/lib/storage/storageService';
import { generateShortCode } from '@/lib/mobile/shortCodeGenerator';
import { UploadPhotoResponse } from '@/lib/contracts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Invalid payload: imageBase64 is required' },
        { status: 400 }
      );
    }

    // Strip data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const shortCode = generateShortCode();
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

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { error: 'Internal server error while saving photo' },
      { status: 500 }
    );
  }
}
