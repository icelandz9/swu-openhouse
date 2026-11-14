import { IPhotoStorage } from './IPhotoStorage';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { CloudflareR2Adapter, CloudSyncStatus, isR2Configured } from './CloudflareR2Adapter';

/**
 * Picks the photo storage:
 * - STORAGE_DRIVER=r2, or R2 keys set and STORAGE_DRIVER unset → Cloudflare R2 (needed on Vercel)
 * - otherwise → files in web/data/ on this machine
 *
 * Stored on globalThis so Next.js dev route bundles share one instance and one single-flight R2 sync lock.
 */
const STORAGE_INSTANCE_VERSION = 2;

const globalForStorage = globalThis as typeof globalThis & {
  __boothStorageInstance?: IPhotoStorage;
  __boothStorageVersion?: number;
};

function isValidCachedInstance(instance: unknown, driver: string): instance is IPhotoStorage {
  if (!instance || globalForStorage.__boothStorageVersion !== STORAGE_INSTANCE_VERSION) {
    return false;
  }
  if (driver === 'r2') {
    return (
      instance instanceof CloudflareR2Adapter &&
      typeof (instance as CloudflareR2Adapter).probeCloud === 'function'
    );
  }
  return instance instanceof LocalStorageAdapter;
}

function getStorage(): IPhotoStorage {
  const driver = process.env.STORAGE_DRIVER || (isR2Configured() ? 'r2' : 'local');
  if (isValidCachedInstance(globalForStorage.__boothStorageInstance, driver)) {
    return globalForStorage.__boothStorageInstance;
  }

  if (driver === 'r2') {
    globalForStorage.__boothStorageInstance = new CloudflareR2Adapter();
  } else if (process.env.VERCEL) {
    // Vercel has no lasting disk: photos saved to web/data/ would vanish or 404 on the next request.
    throw new Error('On Vercel, photos must go to Cloudflare R2: set STORAGE_DRIVER=r2 and the R2_* variables');
  } else {
    globalForStorage.__boothStorageInstance = new LocalStorageAdapter();
  }
  globalForStorage.__boothStorageVersion = STORAGE_INSTANCE_VERSION;
  return globalForStorage.__boothStorageInstance;
}

export function getR2Adapter(): CloudflareR2Adapter | null {
  const s = getStorage();
  return s instanceof CloudflareR2Adapter ? s : null;
}

export async function syncCloudStorageNow() {
  const r2 = getR2Adapter();
  if (!r2) {
    return { synced: 0, failed: 0, remaining: 0 };
  }
  return r2.syncPendingToR2();
}

export async function getCloudSyncStatus(): Promise<CloudSyncStatus> {
  const r2 = getR2Adapter();
  if (!r2) {
    return {
      pendingUploads: 0,
      pendingDeletes: 0,
      pendingCodes: [],
      syncing: false,
      lastSyncAt: null,
      lastSyncedCount: 0,
      lastError: null,
    };
  }
  return r2.getSyncStatus();
}

export async function probeCloudConnectivity() {
  const r2 = getR2Adapter();
  if (!r2) {
    return { online: true, latencyMs: 0 };
  }
  return r2.probeCloud();
}

export async function clearSyncedLocalCache() {
  const r2 = getR2Adapter();
  if (!r2) {
    return { cleared: 0, keptPending: 0 };
  }
  return r2.clearSyncedLocalCache();
}

export const photoStorageService: IPhotoStorage = {
  savePhoto: (code, buffer, mimeType) => getStorage().savePhoto(code, buffer, mimeType),
  getPhotoUrl: (code) => getStorage().getPhotoUrl(code),
  getPhotoBuffer: (code) => getStorage().getPhotoBuffer(code),
  getAllPhotos: () => getStorage().getAllPhotos(),
  deletePhoto: (code) => getStorage().deletePhoto(code),
  isExpired: (createdAtIso) => getStorage().isExpired(createdAtIso),
};
