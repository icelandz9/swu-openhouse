import { IPhotoStorage } from './IPhotoStorage';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { CloudflareR2Adapter } from './CloudflareR2Adapter';

/**
 * Storage Service Factory
 * Switches implementation based on STORAGE_DRIVER environment variable
 */
class StorageServiceFactory {
  private instance: IPhotoStorage | null = null;

  getStorage(): IPhotoStorage {
    if (!this.instance) {
      const driver = process.env.STORAGE_DRIVER || 'local';
      if (driver === 'r2') {
        this.instance = new CloudflareR2Adapter();
      } else {
        this.instance = new LocalStorageAdapter();
      }
    }
    return this.instance;
  }
}

export const photoStorageService = new StorageServiceFactory().getStorage();
