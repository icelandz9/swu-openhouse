import { StoredPhotoResult } from '../contracts';

/**
 * Port Interface for Photo Storage (Clean Architecture / Hexagonal Port)
 * Allows hot-swapping between Local File System and Cloudflare R2
 */
export interface IPhotoStorage {
  /**
   * Save a photo buffer to the underlying storage
   */
  savePhoto(shortCode: string, imageBuffer: Buffer, mimeType?: string): Promise<StoredPhotoResult>;

  /**
   * Retrieve the accessible URL for a given short code
   */
  getPhotoUrl(shortCode: string): Promise<string | null>;

  /**
   * Check if a photo has exceeded its 7-day TTL retention window (PDPA)
   */
  isExpired(createdAtIso: string): boolean;
}
