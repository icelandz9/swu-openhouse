import { IPhotoStorage } from './IPhotoStorage';
import { StoredPhotoResult } from '../contracts';
import fs from 'node:fs/promises';
import path from 'node:path';

export class LocalStorageAdapter implements IPhotoStorage {
  private baseDir = path.join(process.cwd(), 'data', 'photos');

  async savePhoto(shortCode: string, imageBuffer: Buffer): Promise<StoredPhotoResult> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const filePath = path.join(this.baseDir, `${shortCode}.jpg`);
    await fs.writeFile(filePath, imageBuffer);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return {
      photoId: shortCode,
      shortCode,
      url: `/api/photos/${shortCode}/file`,
      storageDriver: 'local',
      expiresAt,
    };
  }

  async getPhotoUrl(shortCode: string): Promise<string | null> {
    const filePath = path.join(this.baseDir, `${shortCode}.jpg`);
    try {
      await fs.access(filePath);
      return `/api/photos/${shortCode}/file`;
    } catch {
      return null;
    }
  }

  isExpired(createdAtIso: string): boolean {
    const ageDays = (Date.now() - new Date(createdAtIso).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > 7;
  }
}
