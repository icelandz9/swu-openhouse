import { IPhotoStorage } from './IPhotoStorage';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { CloudflareR2Adapter, isR2Configured } from './CloudflareR2Adapter';

/**
 * Picks the photo storage:
 * - STORAGE_DRIVER=r2, or R2 keys set and STORAGE_DRIVER unset → Cloudflare R2 (needed on Vercel)
 * - otherwise → files in web/data/ on this machine
 *
 * Created on first use, so a missing setting fails the request with a clear error instead of the build.
 */
let instance: IPhotoStorage | null = null;

function getStorage(): IPhotoStorage {
  if (instance) return instance;

  const driver = process.env.STORAGE_DRIVER || (isR2Configured() ? 'r2' : 'local');
  if (driver === 'r2') {
    instance = new CloudflareR2Adapter();
  } else if (process.env.VERCEL) {
    // Vercel has no lasting disk: photos saved to web/data/ would vanish or 404 on the next request.
    throw new Error('On Vercel, photos must go to Cloudflare R2: set STORAGE_DRIVER=r2 and the R2_* variables');
  } else {
    instance = new LocalStorageAdapter();
  }
  return instance;
}

export const photoStorageService: IPhotoStorage = {
  savePhoto: (code, buffer, mimeType) => getStorage().savePhoto(code, buffer, mimeType),
  getPhotoUrl: (code) => getStorage().getPhotoUrl(code),
  getPhotoBuffer: (code) => getStorage().getPhotoBuffer(code),
  getAllPhotos: () => getStorage().getAllPhotos(),
  deletePhoto: (code) => getStorage().deletePhoto(code),
  isExpired: (createdAtIso) => getStorage().isExpired(createdAtIso),
};
