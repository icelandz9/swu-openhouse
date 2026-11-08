import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/requireStaff';

export async function POST(req: NextRequest) {
  const denied = requireStaff(req);
  if (denied) return denied;
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
