import { IPhotoStorage } from './IPhotoStorage';
import { StoredPhotoResult } from '../contracts';

/**
 * Cloudflare R2 / S3 Adapter
 * Activated when STORAGE_DRIVER=r2 in production
 */
export class CloudflareR2Adapter implements IPhotoStorage {
  private publicDomain: string;

  constructor() {
    this.publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://photos.cpe-swu.com';
  }

  async savePhoto(shortCode: string, _imageBuffer: Buffer): Promise<StoredPhotoResult> {
    // S3 PutObjectCommand will be executed here with R2 credentials
    const url = `${this.publicDomain}/${shortCode}.jpg`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return {
      photoId: shortCode,
      shortCode,
      url,
      storageDriver: 'r2',
      expiresAt,
    };
  }

  async getPhotoUrl(shortCode: string): Promise<string | null> {
    return `${this.publicDomain}/${shortCode}.jpg`;
  }

  isExpired(createdAtIso: string): boolean {
    const ageDays = (Date.now() - new Date(createdAtIso).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > 7;
  }
}
