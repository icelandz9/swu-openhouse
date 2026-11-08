import { NextRequest, NextResponse } from 'next/server';
import {
  authConfigError,
  checkPin,
  clearStaffCookie,
  isStaffRequest,
  setStaffCookie,
} from '@/lib/auth/staffSession';

// GET: is this browser unlocked for staff?
export async function GET(req: NextRequest) {
  return NextResponse.json({ staff: isStaffRequest(req), configError: authConfigError() });
}

// POST { pin }: unlock this browser for staff.
export async function POST(req: NextRequest) {
  const configError = authConfigError();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  if (!checkPin(body?.pin)) {
    // Slow down PIN guessing a little.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json({ error: 'PIN ไม่ถูกต้อง' }, { status: 401 });
  }

  const res = NextResponse.json({ staff: true });
  setStaffCookie(req, res);
  return res;
}

// DELETE: lock this browser again.
export async function DELETE() {
  const res = NextResponse.json({ staff: false });
  clearStaffCookie(res);
  return res;
}
