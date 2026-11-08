// Checks that the R2 settings work for everything the app does: upload, download, list, delete.
// Run from the repo root or from web/:  node web/scripts/test-r2-connection.mjs
// Reads web/.env.local (or .env.local in the current folder) when the variables are not already set.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

for (const envPath of [path.resolve('web', '.env.local'), path.resolve('.env.local')]) {
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
  console.log(`Loaded ${envPath}`);
  break;
}

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME || 'swu-photobooth';

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error('Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY (put them in web/.env.local)');
  process.exit(1);
}

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const enc = (v) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// Same signing as web/lib/storage/CloudflareR2Adapter.ts
async function r2(method, key, { body, query = {}, contentType } = {}) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const urlPath = key ? `/${bucket}/${enc(key)}` : `/${bucket}`;
  const qs = Object.entries(query).map(([k, v]) => [enc(k), enc(v)]).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('&');
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? '');
  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (contentType) headers['content-type'] = contentType;
  const names = Object.keys(headers).sort();
  const canonical = [method, urlPath, qs, names.map((h) => `${h}:${headers[h]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const signature = crypto.createHmac('sha256', hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), 'auto'), 's3'), 'aws4_request')).update(toSign).digest('hex');
  delete headers.host;
  return fetch(`https://${host}${urlPath}${qs ? `?${qs}` : ''}`, {
    method,
    headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` },
    body,
  });
}

async function step(label, fn) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (err) {
    console.error(`✗ ${label}: ${err.message}`);
    process.exit(1);
  }
}

const key = `connection-test-${Date.now()}.txt`;
const payload = new TextEncoder().encode('swu-openhouse r2 connection test');
console.log(`Bucket: ${bucket}\n`);

await step('upload', async () => {
  const res = await r2('PUT', key, { body: payload, contentType: 'text/plain' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
});
await step('download', async () => {
  const res = await r2('GET', key);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if ((await res.text()) !== new TextDecoder().decode(payload)) throw new Error('content differs');
});
await step('list', async () => {
  const res = await r2('GET', null, { query: { 'list-type': '2', 'max-keys': '1000' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  if (!(await res.text()).includes(key)) throw new Error('test file missing from the listing');
});
await step('delete', async () => {
  const res = await r2('DELETE', key);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

console.log('\nR2 is ready. Set STORAGE_DRIVER=r2 to use it.');
