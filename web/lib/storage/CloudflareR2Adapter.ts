import { IPhotoStorage } from './IPhotoStorage';
import { StoredPhotoResult, PhotoRecord } from '../contracts';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import crypto from 'node:crypto';

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}

/**
 * Cloudflare R2 S3-Compatible Storage Adapter (Zero External Dependencies)
 * Uses native Node.js crypto and fetch for AWS Signature Version 4 (SigV4).
 * Activated when R2 credentials are configured or STORAGE_DRIVER=r2.
 */
export class CloudflareR2Adapter implements IPhotoStorage {
  private accountId: string | undefined;
  private accessKeyId: string | undefined;
  private secretAccessKey: string | undefined;
  private bucketName: string;
  private publicDomain: string;
  private fallbackAdapter: LocalStorageAdapter;

  constructor() {
    this.fallbackAdapter = new LocalStorageAdapter();
    this.accountId = process.env.R2_ACCOUNT_ID;
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || 'swu-photobooth';
    this.publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://photos.cpe-swu.com').replace(/\/+$/, '');
  }

  async savePhoto(shortCode: string, imageBuffer: Buffer): Promise<StoredPhotoResult> {
    const key = `${shortCode}.jpg`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (this.accountId && this.accessKeyId && this.secretAccessKey) {
      try {
        const host = `${this.accountId}.r2.cloudflarestorage.com`;
        const path = `/${this.bucketName}/${key}`;
        const endpoint = `https://${host}${path}`;

        const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.substring(0, 8);
        const payloadHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

        const canonicalHeaders = `content-type:image/jpeg\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
        const canonicalRequest = `PUT\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

        const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto
          .createHash('sha256')
          .update(canonicalRequest)
          .digest('hex')}`;

        const signingKey = getSignatureKey(this.secretAccessKey, dateStamp, 'auto', 's3');
        const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

        const authHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const res = await fetch(endpoint, {
          method: 'PUT',
          headers: {
            'Content-Type': 'image/jpeg',
            Host: host,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': amzDate,
            Authorization: authHeader,
          },
          body: new Uint8Array(imageBuffer),
        });

        if (res.ok) {
          // Also save locally for instant kiosk/display caching
          await this.fallbackAdapter.savePhoto(shortCode, imageBuffer).catch(() => {});

          return {
            photoId: shortCode,
            shortCode,
            url: `${this.publicDomain}/${key}`,
            storageDriver: 'r2',
            expiresAt,
          };
        } else {
          console.warn(`R2 upload responded with ${res.status}: ${await res.text()}`);
        }
      } catch (err) {
        console.error('R2 upload failed, using local storage fallback:', err);
      }
    }

    // Fallback to local storage if credentials not configured or upload fails
    return this.fallbackAdapter.savePhoto(shortCode, imageBuffer);
  }

  async getPhotoUrl(shortCode: string): Promise<string | null> {
    if (await this.fallbackAdapter.isDeleted(shortCode)) {
      return null;
    }
    if (this.accountId && this.accessKeyId && this.secretAccessKey) {
      return `${this.publicDomain}/${shortCode}.jpg`;
    }
    return this.fallbackAdapter.getPhotoUrl(shortCode);
  }

  async getPhotoBuffer(shortCode: string): Promise<Buffer | null> {
    if (await this.fallbackAdapter.isDeleted(shortCode)) {
      return null;
    }
    // 1. Check local disk first (fastest on kiosk laptop)
    const localBuf = await this.fallbackAdapter.getPhotoBuffer(shortCode);
    if (localBuf) return localBuf;

    // 2. Fetch from R2 public CDN domain if available
    if (this.publicDomain) {
      try {
        const res = await fetch(`${this.publicDomain}/${shortCode}.jpg`);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          // Cache locally for subsequent calls
          await this.fallbackAdapter.savePhoto(shortCode, buf).catch(() => {});
          return buf;
        }
      } catch (err) {
        console.warn('Failed to fetch photo buffer from public domain:', err);
      }
    }

    // 3. Or fetch directly from R2 S3 endpoint with SigV4 GET
    if (this.accountId && this.accessKeyId && this.secretAccessKey) {
      try {
        const host = `${this.accountId}.r2.cloudflarestorage.com`;
        const path = `/${this.bucketName}/${shortCode}.jpg`;
        const endpoint = `https://${host}${path}`;

        const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.substring(0, 8);
        const emptyPayloadHash = crypto.createHash('sha256').update('').digest('hex');

        const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${emptyPayloadHash}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        const canonicalRequest = `GET\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${emptyPayloadHash}`;

        const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto
          .createHash('sha256')
          .update(canonicalRequest)
          .digest('hex')}`;

        const signingKey = getSignatureKey(this.secretAccessKey, dateStamp, 'auto', 's3');
        const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
        const authHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Host: host,
            'x-amz-content-sha256': emptyPayloadHash,
            'x-amz-date': amzDate,
            Authorization: authHeader,
          },
        });

        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          await this.fallbackAdapter.savePhoto(shortCode, buf).catch(() => {});
          return buf;
        }
      } catch (err) {
        console.warn('Failed to fetch photo buffer directly from R2 endpoint:', err);
      }
    }

    return null;
  }

  async getAllPhotos(): Promise<PhotoRecord[]> {
    const list = await this.fallbackAdapter.getAllPhotos();
    if (this.accountId && this.accessKeyId && this.secretAccessKey) {
      return list.map((item) => ({
        ...item,
        photoUrl: `${this.publicDomain}/${item.code}.jpg`,
      }));
    }
    return list;
  }

  async deletePhoto(shortCode: string): Promise<boolean> {
    const key = `${shortCode}.jpg`;

    if (this.accountId && this.accessKeyId && this.secretAccessKey) {
      try {
        const host = `${this.accountId}.r2.cloudflarestorage.com`;
        const path = `/${this.bucketName}/${key}`;
        const endpoint = `https://${host}${path}`;

        const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.substring(0, 8);
        const emptyPayloadHash = crypto.createHash('sha256').update('').digest('hex');

        const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${emptyPayloadHash}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        const canonicalRequest = `DELETE\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${emptyPayloadHash}`;

        const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto
          .createHash('sha256')
          .update(canonicalRequest)
          .digest('hex')}`;

        const signingKey = getSignatureKey(this.secretAccessKey, dateStamp, 'auto', 's3');
        const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

        const authHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        await fetch(endpoint, {
          method: 'DELETE',
          headers: {
            Host: host,
            'x-amz-content-sha256': emptyPayloadHash,
            'x-amz-date': amzDate,
            Authorization: authHeader,
          },
        }).catch(() => {});
      } catch (err) {
        console.warn('R2 delete request failed:', err);
      }
    }

    return this.fallbackAdapter.deletePhoto(shortCode);
  }

  isExpired(createdAtIso: string): boolean {
    const ageDays = (Date.now() - new Date(createdAtIso).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > 7;
  }
}
