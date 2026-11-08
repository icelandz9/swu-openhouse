import crypto from 'node:crypto';

const DEFAULT_SECRET = 'cpe-swu-openhouse-photobooth-secret-2026';
const PROD_SHARED_SECRET = 'dd4ffede279e18a9105424692ffec64d146633bddc900e5159b7648044084def';

function getSigningSecret(secret?: string): string {
  if (secret) return secret;
  return process.env.AUTH_SECRET?.trim() || PROD_SHARED_SECRET;
}

function getAuthSecrets(explicitSecret?: string): string[] {
  if (explicitSecret) return [explicitSecret];
  const envSecret = process.env.AUTH_SECRET?.trim();
  const secrets: string[] = [];
  if (envSecret) secrets.push(envSecret);
  if (!secrets.includes(PROD_SHARED_SECRET)) secrets.push(PROD_SHARED_SECRET);
  if (!secrets.includes(DEFAULT_SECRET)) secrets.push(DEFAULT_SECRET);
  return secrets;
}

/**
 * Allowed hostnames for QR code generation to prevent Host Header Injection / Phishing (SEC-07).
 */
const ALLOWED_HOST_PATTERNS: (string | RegExp)[] = [
  /^localhost(:\d+)?$/i,
  /^127\.0\.0\.1(:\d+)?$/,
  /^192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  'booth.cpe-swu.com',
  'photos.cpe-swu.com',
  /^.*\.vercel\.app$/i,
];

export function isHostAllowed(hostWithPort: string): boolean {
  if (!hostWithPort) return false;
  const cleanHost = hostWithPort.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  return ALLOWED_HOST_PATTERNS.some((pattern) => {
    if (typeof pattern === 'string') {
      return cleanHost === pattern.toLowerCase();
    }
    return pattern.test(cleanHost);
  });
}

/**
 * Generate a compact, time-bound, salted cryptographic token for photo access.
 * Format: `<exp_base36>.<salt_hex>.<hmac_signature_hex>`
 *
 * @param code Photo short code, e.g. "OPH-AB29"
 * @param ttlSeconds Lifetime of QR display scan before requiring device claim (default 2 hours for event day)
 */
export function generatePhotoToken(
  code: string,
  ttlSeconds: number = 7200,
  secret?: string
): { token: string; expiresAtSec: number } {
  const normCode = code.trim().toUpperCase();
  const expSec = Math.floor(Date.now() / 1000) + ttlSeconds;
  const expBase36 = expSec.toString(36);
  const salt = crypto.randomBytes(2).toString('hex'); // 4-character hex salt

  const dataToSign = `${normCode}:${expBase36}:${salt}`;
  const hmac = crypto
    .createHmac('sha256', getSigningSecret(secret))
    .update(dataToSign)
    .digest('hex')
    .slice(0, 16); // 16 hex chars (64-bit entropy)

  const token = `${expBase36}.${salt}.${hmac}`;
  return { token, expiresAtSec: expSec };
}

/**
 * Verify a photo token against a short code using timing-safe comparison.
 * Checks all known trusted secrets (env AUTH_SECRET, production shared secret, fallback secret)
 * so tokens generated on any local clone or deployed edge node are seamlessly accepted.
 */
export function verifyPhotoToken(
  code: string,
  token: string | null | undefined,
  secret?: string
): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;

  const [expBase36, salt, sig] = parts;
  if (!expBase36 || !salt || !sig) return false;

  // Check expiration
  const expSec = parseInt(expBase36, 36);
  if (isNaN(expSec) || expSec < Math.floor(Date.now() / 1000)) {
    return false; // Expired
  }

  const normCode = code.trim().toUpperCase();
  const dataToSign = `${normCode}:${expBase36}:${salt}`;
  const candidateSecrets = getAuthSecrets(secret);

  for (const candSecret of candidateSecrets) {
    const expectedSig = crypto
      .createHmac('sha256', candSecret)
      .update(dataToSign)
      .digest('hex')
      .slice(0, 16);

    if (sig.length === expectedSig.length) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
          return true;
        }
      } catch {}
    }
  }

  return false;
}

/**
 * Generate a 7-day persistent device claim cookie signature.
 * Once an attendee scans the QR code on their phone, this cookie is placed in their browser
 * so they can view and edit their photo for the full 7-day retention period.
 */
export function generatePhotoClaimSecret(code: string, secret?: string): string {
  const normCode = code.trim().toUpperCase();
  return crypto
    .createHmac('sha256', getSigningSecret(secret))
    .update(`claim:${normCode}`)
    .digest('hex')
    .slice(0, 24);
}

export function verifyPhotoClaimSecret(
  code: string,
  cookieValue: string | null | undefined,
  secret?: string
): boolean {
  if (!cookieValue || typeof cookieValue !== 'string') return false;
  const normCode = code.trim().toUpperCase();
  const candidateSecrets = getAuthSecrets(secret);

  for (const candSecret of candidateSecrets) {
    const expected = crypto
      .createHmac('sha256', candSecret)
      .update(`claim:${normCode}`)
      .digest('hex')
      .slice(0, 24);

    if (cookieValue.length === expected.length) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(cookieValue), Buffer.from(expected))) {
          return true;
        }
      } catch {}
    }
  }

  return false;
}
