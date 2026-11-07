import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'swu-openhouse-photobooth',
    version: '1.0.0',
    aspectRatio: '4:3',
  });
}
