import { NextRequest, NextResponse } from 'next/server';
import { photoStorageService } from '@/lib/storage/storageService';
import { isValidShortCode } from '@/lib/mobile/shortCodeGenerator';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!isValidShortCode(code)) {
      return NextResponse.json({ error: 'Invalid short code format' }, { status: 400 });
    }

    const photoUrl = await photoStorageService.getPhotoUrl(code);
    if (!photoUrl) {
      return NextResponse.json({ error: 'Photo not found or expired' }, { status: 404 });
    }

    return NextResponse.json({
      code,
      photoUrl,
    });
  } catch (error: any) {
    console.error('Error retrieving photo:', error);
    return NextResponse.json(
      { error: 'Internal server error while retrieving photo' },
      { status: 500 }
    );
  }
}
