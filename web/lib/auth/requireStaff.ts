import { NextRequest, NextResponse } from 'next/server';
import { isStaffRequest } from './staffSession';

// Returns a 401 response when the caller is not an unlocked staff browser, otherwise null.
export function requireStaff(req: NextRequest, headers?: Record<string, string>): NextResponse | null {
  if (isStaffRequest(req)) return null;
  return NextResponse.json(
    { error: 'ต้องปลดล็อกด้วย PIN ของสตาฟก่อน' },
    { status: 401, headers }
  );
}
