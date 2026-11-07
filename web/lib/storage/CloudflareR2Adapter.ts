import { IPhotoStorage } from './IPhotoStorage';
import { StoredPhotoResult, PhotoRecord } from '../contracts';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { LocalStorageAdapter } from './LocalStorageAdapter';

/**
 * Cloudflare R2 / AWS S3 S3-Compatible Storage Adapter
 * Activated when STORAGE_DRIVER=r2 or when R2 credentials are configured
 */
export class CloudflareR2Adapter implements IPhotoStorage {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private publicDomain: string;
  private fallbackAdapter: LocalStorageAdapter;

  constructor() {
    this.fallbackAdapter = new LocalStorageAdapter();
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || 'swu-photobooth';
    this.publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://photos.cpe-swu.com').replace(/\/+$/, '');

    if (accountId && accessKeyId && secretAccessKey) {
      try {
        this.s3Client = new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
      } catch (err) {
        console.warn('Failed to initialize Cloudflare R2 client, will use local storage fallback:', err);
      }
    }
  }

  async savePhoto(shortCode: string, imageBuffer: Buffer): Promise<StoredPhotoResult> {
    const key = `${shortCode}.jpg`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: imageBuffer,
            ContentType: 'image/jpeg',
            CacheControl: 'public, max-age=604800, immutable',
          })
        );

        // Also save locally for instant kiosk/display caching
        await this.fallbackAdapter.savePhoto(shortCode, imageBuffer).catch(() => {});

        return {
          photoId: shortCode,
          shortCode,
          url: `${this.publicDomain}/${key}`,
          storageDriver: 'r2',
          expiresAt,
        };
      } catch (err) {
        console.error('R2 upload failed, falling back to local storage:', err);
      }
    }

    // Fallback to local storage if R2 not configured or network error
    return this.fallbackAdapter.savePhoto(shortCode, imageBuffer);
  }

  async getPhotoUrl(shortCode: string): Promise<string | null> {
    if (this.s3Client) {
      return `${this.publicDomain}/${shortCode}.jpg`;
    }
    return this.fallbackAdapter.getPhotoUrl(shortCode);
  }

  async getPhotoBuffer(shortCode: string): Promise<Buffer | null> {
    return this.fallbackAdapter.getPhotoBuffer(shortCode);
  }

  async getAllPhotos(): Promise<PhotoRecord[]> {
    return this.fallbackAdapter.getAllPhotos();
  }

  async deletePhoto(shortCode: string): Promise<boolean> {
    const key = `${shortCode}.jpg`;
    let r2Success = true;

    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          })
        );
      } catch (err) {
        console.warn('Failed to delete from R2:', err);
        r2Success = false;
      }
    }

    const localSuccess = await this.fallbackAdapter.deletePhoto(shortCode);
    return r2Success || localSuccess;
  }

  isExpired(createdAtIso: string): boolean {
    const ageDays = (Date.now() - new Date(createdAtIso).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > 7;
  }
}
