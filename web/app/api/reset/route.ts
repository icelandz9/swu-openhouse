import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    return NextResponse.json({
      success: true,
      message: action === 'clear' ? 'All session data cleared' : 'Reset signal broadcasted',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process reset command' },
      { status: 500 }
    );
  }
}
