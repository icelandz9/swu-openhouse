/**
 * Short code generator for SWU Open House
 * Formats: "OPH-XXXX" where XXXX is 4 alphanumeric chars excluding ambiguous chars (0, O, 1, I, L)
 */
const ALLOWED_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateShortCode(): string {
  let result = '';
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * ALLOWED_CHARS.length);
    result += ALLOWED_CHARS[randomIndex];
  }
  return `OPH-${result}`;
}

export function isValidShortCode(code: string): boolean {
  return /^OPH-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/i.test(code);
}
