import { StoredPhotoResult, PhotoRecord } from '../contracts';

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
   * Retrieve the raw binary buffer of a photo
   */
  getPhotoBuffer(shortCode: string): Promise<Buffer | null>;

  /**
   * Retrieve all photo records stored in the system
   */
  getAllPhotos(): Promise<PhotoRecord[]>;

  /**
   * Delete a photo by short code
   */
  deletePhoto(shortCode: string): Promise<boolean>;

  /**
   * Check if a photo has exceeded its 7-day TTL retention window (PDPA)
   */
  isExpired(createdAtIso: string): boolean;
}
