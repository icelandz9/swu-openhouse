// Staff session for /admin and the APIs only staff may call (photo list, delete, reset).
// Staff unlock once with ADMIN_PIN; the server then sets a signed, httpOnly cookie on that browser.
import crypto from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const STAFF_COOKIE = 'booth_staff';
const SESSION_DAYS = 3;

const onVercel = Boolean(process.env.VERCEL);

// Without ADMIN_PIN, local machines fall back to 1234; a deployed site refuses all logins instead.
export function getAdminPin(): string | null {
  const pin = process.env.ADMIN_PIN?.trim();
  if (pin) return pin;
  return onVercel ? null : '1234';
}

// A deployed site needs a fixed AUTH_SECRET (serverless instances don't share memory).
// Locally a random per-process secret is fine: staff just unlock again after a restart.
// Kept on globalThis because `next dev` bundles each route separately; a module-level value would
// differ between /api/auth and the other routes, and no cookie would ever verify.
const globalForAuth = globalThis as typeof globalThis & { __boothLocalSecret?: string };
function getSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  if (onVercel) return null;
  globalForAuth.__boothLocalSecret ??= crypto.randomBytes(32).toString('hex');
  return globalForAuth.__boothLocalSecret;
}

export function authConfigError(): string | null {
  if (!getAdminPin()) return 'ยังไม่ได้ตั้งค่า ADMIN_PIN บนเซิร์ฟเวอร์';
  if (!getSecret()) return 'ยังไม่ได้ตั้งค่า AUTH_SECRET บนเซิร์ฟเวอร์';
  return null;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function checkPin(pin: unknown): boolean {
  const expected = getAdminPin();
  return Boolean(expected) && typeof pin === 'string' && safeEqual(pin.trim(), expected!);
}

export function isStaffRequest(req: NextRequest): boolean {
  const secret = getSecret();
  const token = req.cookies.get(STAFF_COOKIE)?.value;
  if (!secret || !token) return false;
  const [expires, signature] = token.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return safeEqual(signature, sign(expires, secret));
}

export function setStaffCookie(req: NextRequest, res: NextResponse): void {
  const secret = getSecret();
  if (!secret) return;
  const expires = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  res.cookies.set(STAFF_COOKIE, `${expires}.${sign(expires, secret)}`, {
    httpOnly: true,
    sameSite: 'lax',
    // Only mark Secure on https, so the booth still works over plain http on a LAN.
    secure: (req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')) === 'https',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearStaffCookie(res: NextResponse): void {
  res.cookies.set(STAFF_COOKIE, '', { path: '/', maxAge: 0 });
}
