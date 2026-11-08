import { IPhotoStorage } from './IPhotoStorage';
import { StoredPhotoResult, PhotoRecord } from '../contracts';
import fs from 'node:fs/promises';
import path from 'node:path';

interface StoredMetadata {
  code: string;
  photoUrl: string;
  qrUrl: string;
  createdAt: string;
  expiresAt: string;
}

export class LocalStorageAdapter implements IPhotoStorage {
  private baseDir = path.join(process.cwd(), 'data', 'photos');
  private metaFile = path.join(process.cwd(), 'data', 'photos-meta.json');
  private deletedFile = path.join(process.cwd(), 'data', 'deleted-codes.json');
  private memoryCache: Map<string, Buffer> = new Map();
  private metaCache: Map<string, StoredMetadata> = new Map();
  private deletedCodes: Set<string> = new Set();
  private initialized = false;
  // Keep only the most recent photos in RAM; older ones are read from disk when asked for.
  private static readonly MEMORY_CACHE_LIMIT = 100;

  private async ensureInit() {
    if (this.initialized) return;
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      const metaContent = await fs.readFile(this.metaFile, 'utf-8').catch(() => '[]');
      const list: StoredMetadata[] = JSON.parse(metaContent);
      for (const item of list) {
        this.metaCache.set(item.code, item);
      }
    } catch {
      // Ignore initial file read errors
    }

    try {
      const delContent = await fs.readFile(this.deletedFile, 'utf-8').catch(() => '[]');
      const delList: string[] = JSON.parse(delContent);
      for (const c of delList) {
        this.deletedCodes.add(c);
      }
    } catch {
      // Ignore initial file read errors
    }

    this.initialized = true;
    this.pruneExpiredPhotos().catch(() => {});
  }

  async pruneExpiredPhotos(): Promise<number> {
    let pruned = 0;
    for (const [code, meta] of Array.from(this.metaCache.entries())) {
      if (this.isExpired(meta.createdAt)) {
        await this.deletePhoto(code);
        pruned++;
      }
    }
    return pruned;
  }

  private cachePhoto(shortCode: string, buffer: Buffer) {
    this.memoryCache.delete(shortCode);
    this.memoryCache.set(shortCode, buffer);
    while (this.memoryCache.size > LocalStorageAdapter.MEMORY_CACHE_LIMIT) {
      const oldest = this.memoryCache.keys().next().value;
      if (oldest === undefined) break;
      this.memoryCache.delete(oldest);
    }
  }

  // Deleted by staff, or older than the 7-day PDPA window.
  private isGone(shortCode: string): boolean {
    if (this.deletedCodes.has(shortCode)) return true;
    const meta = this.metaCache.get(shortCode);
    return meta ? this.isExpired(meta.createdAt) : false;
  }

  private async saveMeta() {
    try {
      const list = Array.from(this.metaCache.values());
      await fs.writeFile(this.metaFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save photo metadata:', err);
    }
  }

  private async saveDeleted() {
    try {
      const list = Array.from(this.deletedCodes);
      await fs.writeFile(this.deletedFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save deleted codes list:', err);
    }
  }

  async savePhoto(shortCode: string, imageBuffer: Buffer): Promise<StoredPhotoResult> {
    await this.ensureInit();
    // If it was previously marked deleted, un-delete it on new capture
    if (this.deletedCodes.has(shortCode)) {
      this.deletedCodes.delete(shortCode);
      await this.saveDeleted();
    }

    const filePath = path.join(this.baseDir, `${shortCode}.jpg`);
    await fs.writeFile(filePath, imageBuffer);
    this.cachePhoto(shortCode, imageBuffer);

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const photoUrl = `/api/photos/${shortCode}/file`;
    const qrUrl = `/p/${shortCode}`;

    const meta: StoredMetadata = {
      code: shortCode,
      photoUrl,
      qrUrl,
      createdAt,
      expiresAt,
    };
    this.metaCache.set(shortCode, meta);
    await this.saveMeta();

    return {
      photoId: shortCode,
      shortCode,
      url: photoUrl,
      storageDriver: 'local',
      expiresAt,
    };
  }

  async getPhotoUrl(shortCode: string): Promise<string | null> {
    await this.ensureInit();
    if (this.isGone(shortCode)) {
      return null;
    }
    if (this.memoryCache.has(shortCode)) {
      return `/api/photos/${shortCode}/file`;
    }
    const filePath = path.join(this.baseDir, `${shortCode}.jpg`);
    try {
      await fs.access(filePath);
      return `/api/photos/${shortCode}/file`;
    } catch {
      return null;
    }
  }

  async isDeleted(shortCode: string): Promise<boolean> {
    await this.ensureInit();
    return this.deletedCodes.has(shortCode);
  }

  async getPhotoBuffer(shortCode: string): Promise<Buffer | null> {
    await this.ensureInit();
    if (this.isGone(shortCode)) {
      return null;
    }
    const cached = this.memoryCache.get(shortCode);
    if (cached) {
      this.cachePhoto(shortCode, cached);
      return cached;
    }
    const filePath = path.join(this.baseDir, `${shortCode}.jpg`);
    try {
      const buf = await fs.readFile(filePath);
      this.cachePhoto(shortCode, buf);
      return buf;
    } catch {
      return null;
    }
  }

  async getAllPhotos(): Promise<PhotoRecord[]> {
    await this.ensureInit();
    const list = Array.from(this.metaCache.values()).filter(
      (p) => !this.isGone(p.code)
    );
    // Sort descending by createdAt
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }

  async deletePhoto(shortCode: string): Promise<boolean> {
    await this.ensureInit();
    this.memoryCache.delete(shortCode);
    this.metaCache.delete(shortCode);
    this.deletedCodes.add(shortCode);
    await this.saveMeta();
    await this.saveDeleted();

    const filePath = path.join(this.baseDir, `${shortCode}.jpg`);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file did not exist on disk
    }
    return true;
  }

  isExpired(createdAtIso: string): boolean {
    const ageDays = (Date.now() - new Date(createdAtIso).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > 7;
  }
}
