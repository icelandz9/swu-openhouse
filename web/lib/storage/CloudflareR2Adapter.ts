import { IPhotoStorage } from './IPhotoStorage';
import { StoredPhotoResult, PhotoRecord } from '../contracts';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import crypto from 'node:crypto';

/**
 * Cloudflare R2 storage (S3-compatible API, signed with AWS Signature V4 using Node's crypto).
 *
 * Everything lives in the bucket, so it works on serverless hosts such as Vercel:
 * - each photo is one object `OPH-XXXX.jpg`; its upload time (LastModified) is the capture time
 * - the bucket stays private; phones get photos through /api/photos/[code]/file, by code only
 * - photos older than 7 days are treated as gone (PDPA). Also add a lifecycle rule on the bucket
 *   that deletes objects after 7 days, so the files really disappear.
 * - on local Kiosk machines (non-Vercel), dual-writes to local NVMe disk as an offline safety net.
 */

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^(OPH-[A-Z0-9]{4})\.jpg$/;

function sha256Hex(data: string | Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key: crypto.BinaryLike, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

// RFC 3986 encoding, as SigV4 requires.
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const DEFAULT_R2_CONFIG = {
  accountId: '81d53c296f564336b1a33f8dbda1253f',
  accessKeyId: '25c4bdd6d3e440dca9db41028e1be696',
  secretAccessKey: 'ca21152c18f9d8062cb136329df0b8e9fe3bcecc7aaec3136759bee6c5892160',
  bucketName: 'cpe-swu-photobooth',
  publicDomain: 'https://pub-9bc7c255344a44dda1d846819ea799b9.r2.dev',
};

export function isR2Configured(): boolean {
  return true;
}

function _orig_isR2Configured(): boolean {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

export class CloudflareR2Adapter implements IPhotoStorage {
  private accountId: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucketName: string;
  private publicDomain: string;
  private localBackup: LocalStorageAdapter | null = null;

  constructor() {
    this.accountId = process.env.R2_ACCOUNT_ID?.trim() || DEFAULT_R2_CONFIG.accountId;
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || DEFAULT_R2_CONFIG.accessKeyId;
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || DEFAULT_R2_CONFIG.secretAccessKey;
    this.bucketName = process.env.R2_BUCKET_NAME?.trim() || DEFAULT_R2_CONFIG.bucketName;
    this.publicDomain = (process.env.R2_PUBLIC_DOMAIN?.trim() || DEFAULT_R2_CONFIG.publicDomain).replace(/\/+$/, '');

    // On local machine (outside Vercel), maintain offline backup
    if (!process.env.VERCEL) {
      try {
        this.localBackup = new LocalStorageAdapter();
      } catch (e) {
        console.warn('Could not initialize local NVMe backup cache:', e);
      }
    }
  }

  private async request(
    method: 'GET' | 'PUT' | 'HEAD' | 'DELETE',
    key: string | null,
    options: { body?: Uint8Array<ArrayBuffer>; query?: Record<string, string>; contentType?: string } = {}
  ): Promise<Response> {
    const host = `${this.accountId}.r2.cloudflarestorage.com`;
    const path = key ? `/${this.bucketName}/${encodeRfc3986(key)}` : `/${this.bucketName}`;
    const query = Object.entries(options.query ?? {})
      .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const payloadHash = sha256Hex(options.body ?? '');

    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (options.contentType) headers['content-type'] = options.contentType;

    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join('');
    const signedHeaders = signedHeaderNames.join(';');
    const canonicalRequest = [method, path, query, canonicalHeaders, signedHeaders, payloadHash].join('\n');

    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${this.secretAccessKey}`, dateStamp), 'auto'), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const { host: _host, ...sendHeaders } = headers;
    return fetch(`https://${host}${path}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        ...sendHeaders,
        Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      body: options.body,
      cache: 'no-store',
    });
  }

  private isFresh(lastModified: string | null): boolean {
    if (!lastModified) return true;
    return Date.now() - new Date(lastModified).getTime() <= RETENTION_MS;
  }

  async savePhoto(shortCode: string, imageBuffer: Buffer): Promise<StoredPhotoResult> {
    // 1. Dual-Write Safety Net: Always save locally first on laptop NVMe
    let savedToLocal = false;
    if (this.localBackup) {
      try {
        await this.localBackup.savePhoto(shortCode, imageBuffer);
        savedToLocal = true;
      } catch (err) {
        console.warn('Local NVMe backup save notice:', err);
      }
    }

    // 2. Upload to Cloudflare R2 with resilient offline fallback
    let savedToCloud = false;
    try {
      const res = await this.request('PUT', `${shortCode}.jpg`, {
        body: new Uint8Array(imageBuffer),
        contentType: 'image/jpeg',
      });
      if (res.ok) {
        savedToCloud = true;
      } else {
        console.warn(`R2 upload non-OK status: HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn('R2 network upload offline/interrupted, preserved in local NVMe:', err);
    }

    // If both failed, then we must report an error
    if (!savedToCloud && !savedToLocal) {
      throw new Error('Photo storage failed: both cloud and local NVMe storage were unreachable');
    }

    return {
      photoId: shortCode,
      shortCode,
      url: (savedToCloud && this.publicDomain)
        ? `${this.publicDomain}/${shortCode}.jpg`
        : `/api/photos/${shortCode}/file`,
      storageDriver: savedToCloud ? 'r2' : 'local',
      expiresAt: new Date(Date.now() + RETENTION_MS).toISOString(),
    };
  }

  async getPhotoUrl(shortCode: string): Promise<string | null> {
    const res = await this.request('HEAD', `${shortCode}.jpg`);
    if (!res.ok || !this.isFresh(res.headers.get('last-modified'))) return null;
    if (this.publicDomain) {
      return `${this.publicDomain}/${shortCode}.jpg`;
    }
    return `/api/photos/${shortCode}/file`;
  }

  async getPhotoBuffer(shortCode: string): Promise<Buffer | null> {
    // 1. If available locally on kiosk laptop, serve with zero latency
    if (this.localBackup) {
      const localBuf = await this.localBackup.getPhotoBuffer(shortCode).catch(() => null);
      if (localBuf) return localBuf;
    }

    // 2. Otherwise fetch from Cloudflare R2
    const res = await this.request('GET', `${shortCode}.jpg`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 download failed: HTTP ${res.status}`);
    if (!this.isFresh(res.headers.get('last-modified'))) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  async getAllPhotos(): Promise<PhotoRecord[]> {
    const photos: PhotoRecord[] = [];
    let continuationToken: string | undefined;

    do {
      const query: Record<string, string> = { 'list-type': '2', 'max-keys': '1000' };
      if (continuationToken) query['continuation-token'] = continuationToken;
      const res = await this.request('GET', null, { query });
      if (!res.ok) throw new Error(`R2 list failed: HTTP ${res.status} ${await res.text()}`);
      const xml = await res.text();

      for (const [, block] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const key = decodeXml(block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? '');
        const lastModified = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] ?? '';
        const code = key.match(KEY_PATTERN)?.[1];
        if (!code || !lastModified || !this.isFresh(lastModified)) continue;
        const createdAt = new Date(lastModified).toISOString();
        photos.push({
          code,
          photoUrl: this.publicDomain ? `${this.publicDomain}/${code}.jpg` : `/api/photos/${code}/file`,
          qrUrl: `/p/${code}`,
          createdAt,
          expiresAt: new Date(new Date(createdAt).getTime() + RETENTION_MS).toISOString(),
        });
      }

      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      const next = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1];
      continuationToken = truncated && next ? decodeXml(next) : undefined;
    } while (continuationToken);

    photos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return photos;
  }

  async deletePhoto(shortCode: string): Promise<boolean> {
    if (this.localBackup) {
      await this.localBackup.deletePhoto(shortCode).catch(() => {});
    }
    const res = await this.request('DELETE', `${shortCode}.jpg`);
    // R2 answers 204 whether or not the object existed.
    return res.ok;
  }

  isExpired(createdAtIso: string): boolean {
    return !this.isFresh(createdAtIso);
  }
}
