import { IPhotoStorage } from './IPhotoStorage';
import { StoredPhotoResult, PhotoRecord } from '../contracts';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Cloudflare R2 storage (S3-compatible API, signed with AWS Signature V4 using Node's crypto).
 *
 * Everything lives in the bucket, so it works on serverless hosts such as Vercel:
 * - each photo is one object `OPH-XXXX.jpg`; its upload time (LastModified) is the capture time
 * - the bucket stays private; phones get photos through /api/photos/[code]/file, by code only
 * - photos older than 7 days are treated as gone (PDPA). Also add a lifecycle rule on the bucket
 *   that deletes objects after 7 days, so the files really disappear.
 * - on local Kiosk machines (non-Vercel), dual-writes to local NVMe disk as an offline safety net
 *   and maintains a persistent offline queue that automatically flushes to R2 once internet recovers.
 */

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^(OPH-[A-Z0-9]{4})\.jpg$/;
const DEFAULT_HTTP_TIMEOUT_MS = 8000;
const PROBE_HTTP_TIMEOUT_MS = 3500;

export interface PendingR2Upload {
  code: string;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
}

export interface PendingR2Delete {
  code: string;
  deletedAt: string;
}

export interface CloudSyncStatus {
  pendingUploads: number;
  pendingDeletes: number;
  pendingCodes: string[];
  syncing: boolean;
  lastSyncAt: number | null;
  lastSyncedCount: number;
  lastError: string | null;
}

function sha256Hex(data: string | Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key: crypto.BinaryLike, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

// RFC 3986 encoding, as SigV4 requires.
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const DEFAULT_R2_CONFIG = {
  accountId: '81d53c296f564336b1a33f8dbda1253f',
  accessKeyId: '25c4bdd6d3e440dca9db41028e1be696',
  secretAccessKey: 'ca21152c18f9d8062cb136329df0b8e9fe3bcecc7aaec3136759bee6c5892160',
  bucketName: 'cpe-swu-photobooth',
  publicDomain: 'https://pub-9bc7c255344a44dda1d846819ea799b9.r2.dev',
};

export function isR2Configured(): boolean {
  return true;
}

export class CloudflareR2Adapter implements IPhotoStorage {
  private accountId: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucketName: string;
  private publicDomain: string;
  private localBackup: LocalStorageAdapter | null = null;
  private pendingUploadsFile: string;
  private pendingDeletesFile: string;
  private activeSyncPromise: Promise<{ synced: number; failed: number; remaining: number }> | null = null;
  private queueLock: Promise<unknown> = Promise.resolve();
  private lastSyncAt: number | null = null;
  private lastSyncedCount = 0;
  private lastSyncError: string | null = null;

  constructor() {
    this.accountId = process.env.R2_ACCOUNT_ID?.trim() || DEFAULT_R2_CONFIG.accountId;
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || DEFAULT_R2_CONFIG.accessKeyId;
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || DEFAULT_R2_CONFIG.secretAccessKey;
    this.bucketName = process.env.R2_BUCKET_NAME?.trim() || DEFAULT_R2_CONFIG.bucketName;
    this.publicDomain = (process.env.R2_PUBLIC_DOMAIN?.trim() || DEFAULT_R2_CONFIG.publicDomain).replace(/\/+$/, '');

    const dataDir = path.join(process.cwd(), 'data');
    this.pendingUploadsFile = path.join(dataDir, 'pending-r2-uploads.json');
    this.pendingDeletesFile = path.join(dataDir, 'pending-r2-deletes.json');

    // On local machine (outside Vercel), maintain offline backup
    if (!process.env.VERCEL) {
      try {
        this.localBackup = new LocalStorageAdapter();
      } catch (e) {
        console.warn('Could not initialize local NVMe backup cache:', e);
      }
    }
  }

  private async request(
    method: 'GET' | 'PUT' | 'HEAD' | 'DELETE',
    key: string | null,
    options: { body?: Uint8Array<ArrayBuffer>; query?: Record<string, string>; contentType?: string; timeoutMs?: number } = {}
  ): Promise<Response> {
    const host = `${this.accountId}.r2.cloudflarestorage.com`;
    const encodedKey = key
      ? key
          .split('/')
          .map((seg) => encodeRfc3986(seg))
          .join('/')
      : null;
    const pathUrl = encodedKey ? `/${this.bucketName}/${encodedKey}` : `/${this.bucketName}`;
    const query = Object.entries(options.query ?? {})
      .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const payloadHash = sha256Hex(options.body ?? '');

    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (options.contentType) headers['content-type'] = options.contentType;

    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join('');
    const signedHeaders = signedHeaderNames.join(';');
    const canonicalRequest = [method, pathUrl, query, canonicalHeaders, signedHeaders, payloadHash].join('\n');

    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${this.secretAccessKey}`, dateStamp), 'auto'), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const { host: _host, ...sendHeaders } = headers;
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(`https://${host}${pathUrl}${query ? `?${query}` : ''}`, {
        method,
        headers: {
          ...sendHeaders,
          Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        },
        body: options.body,
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private isFresh(lastModified: string | null): boolean {
    if (!lastModified) return true;
    return Date.now() - new Date(lastModified).getTime() <= RETENTION_MS;
  }

  private withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queueLock.then(fn, fn);
    this.queueLock = next.catch(() => {});
    return next;
  }

  private async readJsonQueue<T extends { code?: unknown }>(filePath: string): Promise<T[]> {
    if (process.env.VERCEL) return [];
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is T => Boolean(item && typeof item.code === 'string' && /^[A-Z0-9_-]{3,24}$/i.test(item.code))
      );
    } catch {
      return [];
    }
  }

  private async writeJsonQueue<T>(filePath: string, list: T[]): Promise<void> {
    if (process.env.VERCEL) return;
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(list, null, 2), 'utf-8');
      await fs.rename(tmpPath, filePath);
    } catch (err) {
      console.warn('Failed to persist R2 queue file:', filePath, err);
    }
  }

  private enqueueUpload(code: string, createdAt: string, errorMsg: string): Promise<void> {
    if (process.env.VERCEL) return Promise.resolve();
    return this.withQueueLock(async () => {
      const queue = await this.readJsonQueue<PendingR2Upload>(this.pendingUploadsFile);
      const existing = queue.find((item) => item.code === code);
      if (existing) {
        existing.attempts += 1;
        existing.lastAttemptAt = Date.now();
        existing.lastError = errorMsg;
      } else {
        queue.push({
          code,
          createdAt,
          attempts: 1,
          lastAttemptAt: Date.now(),
          lastError: errorMsg,
        });
      }
      await this.writeJsonQueue(this.pendingUploadsFile, queue);
    });
  }

  private removePendingUpload(code: string): Promise<void> {
    if (process.env.VERCEL) return Promise.resolve();
    return this.withQueueLock(async () => {
      const queue = await this.readJsonQueue<PendingR2Upload>(this.pendingUploadsFile);
      const filtered = queue.filter((item) => item.code !== code);
      if (filtered.length !== queue.length) {
        await this.writeJsonQueue(this.pendingUploadsFile, filtered);
      }
    });
  }

  private enqueueDelete(code: string): Promise<void> {
    if (process.env.VERCEL) return Promise.resolve();
    return this.withQueueLock(async () => {
      const queue = await this.readJsonQueue<PendingR2Delete>(this.pendingDeletesFile);
      if (!queue.some((item) => item.code === code)) {
        queue.push({ code, deletedAt: new Date().toISOString() });
        await this.writeJsonQueue(this.pendingDeletesFile, queue);
      }
    });
  }

  private removePendingDelete(code: string): Promise<void> {
    if (process.env.VERCEL) return Promise.resolve();
    return this.withQueueLock(async () => {
      const queue = await this.readJsonQueue<PendingR2Delete>(this.pendingDeletesFile);
      const filtered = queue.filter((item) => item.code !== code);
      if (filtered.length !== queue.length) {
        await this.writeJsonQueue(this.pendingDeletesFile, filtered);
      }
    });
  }

  private async listR2Photos(): Promise<PhotoRecord[]> {
    const photos: PhotoRecord[] = [];
    let continuationToken: string | undefined;

    do {
      const query: Record<string, string> = { 'list-type': '2', 'max-keys': '1000' };
      if (continuationToken) query['continuation-token'] = continuationToken;
      const res = await this.request('GET', null, { query, timeoutMs: 5500 });
      if (!res.ok) throw new Error(`R2 list failed: HTTP ${res.status} ${await res.text()}`);
      const xml = await res.text();

      for (const [, block] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const key = decodeXml(block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? '');
        const lastModified = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] ?? '';
        const code = key.match(KEY_PATTERN)?.[1];
        if (!code || !lastModified || !this.isFresh(lastModified)) continue;
        const createdAt = new Date(lastModified).toISOString();
        photos.push({
          code,
          photoUrl: this.publicDomain ? `${this.publicDomain}/${code}.jpg` : `/api/photos/${code}/file`,
          qrUrl: `/p/${code}`,
          createdAt,
          expiresAt: new Date(new Date(createdAt).getTime() + RETENTION_MS).toISOString(),
          pendingCloudSync: false,
          storageDriver: 'r2',
        });
      }

      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      const next = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1];
      continuationToken = truncated && next ? decodeXml(next) : undefined;
    } while (continuationToken);

    return photos;
  }

  /** Probes live Cloudflare R2 connectivity and latency without hanging offline servers. */
  async probeCloud(): Promise<{ online: boolean; latencyMs: number | null; error?: string }> {
    const start = Date.now();
    try {
      const res = await this.request('GET', null, {
        query: { 'list-type': '2', 'max-keys': '1' },
        timeoutMs: PROBE_HTTP_TIMEOUT_MS,
      });
      if (!res.ok) {
        return { online: false, latencyMs: null, error: `HTTP ${res.status}` };
      }
      return { online: true, latencyMs: Math.max(1, Date.now() - start) };
    } catch (err: any) {
      return {
        online: false,
        latencyMs: null,
        error: err?.name === 'AbortError' ? 'Timeout' : (err?.message || 'Offline'),
      };
    }
  }

  /** Lightweight read/write of system control JSON on R2 (key prefixed with `_system/`, ignored by photo listing). */
  async readRemoteJson<T>(key: string): Promise<T | null> {
    try {
      const res = await this.request('GET', key, { timeoutMs: 2800 });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  async writeRemoteJson(key: string, payload: unknown): Promise<boolean> {
    try {
      const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
      const res = await this.request('PUT', key, {
        body: new Uint8Array(jsonBytes.buffer.slice(0)) as Uint8Array<ArrayBuffer>,
        contentType: 'application/json',
        timeoutMs: 2800,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getSyncStatus(): Promise<CloudSyncStatus> {
    const uploads = await this.readJsonQueue<PendingR2Upload>(this.pendingUploadsFile);
    const deletes = await this.readJsonQueue<PendingR2Delete>(this.pendingDeletesFile);
    return {
      pendingUploads: uploads.length,
      pendingDeletes: deletes.length,
      pendingCodes: uploads.map((u) => u.code),
      syncing: Boolean(this.activeSyncPromise),
      lastSyncAt: this.lastSyncAt,
      lastSyncedCount: this.lastSyncedCount,
      lastError: this.lastSyncError,
    };
  }

  /**
   * Single-flight synchronization of offline local photos & deletes to Cloudflare R2.
   * Reconciles both explicit pending queue AND any fresh local NVMe photos missing from R2.
   */
  async syncPendingToR2(knownR2Codes?: Set<string>): Promise<{ synced: number; failed: number; remaining: number }> {
    if (process.env.VERCEL || !this.localBackup) {
      return { synced: 0, failed: 0, remaining: 0 };
    }
    if (this.activeSyncPromise) {
      return this.activeSyncPromise;
    }

    this.activeSyncPromise = (async () => {
      let synced = 0;
      let failed = 0;

      try {
        // 1. Flush any deferred offline deletes first (PDPA guarantee)
        const pendingDeletes = await this.withQueueLock(() =>
          this.readJsonQueue<PendingR2Delete>(this.pendingDeletesFile)
        );
        const completedDeleteCodes = new Set<string>();
        for (const delItem of pendingDeletes) {
          try {
            const res = await this.request('DELETE', `${delItem.code}.jpg`, { timeoutMs: 5000 });
            if (res.ok || res.status === 404) {
              completedDeleteCodes.add(delItem.code);
            }
          } catch {
            // Keep failed delete in queue for next sync attempt
          }
        }
        if (completedDeleteCodes.size > 0) {
          await this.withQueueLock(async () => {
            const latestDeletes = await this.readJsonQueue<PendingR2Delete>(this.pendingDeletesFile);
            const updatedDeletes = latestDeletes.filter((item) => !completedDeleteCodes.has(item.code));
            await this.writeJsonQueue(this.pendingDeletesFile, updatedDeletes);
          });
        }

        // 2. Gather candidate uploads from explicit queue + local photos missing in R2
        const pendingQueue = await this.withQueueLock(() =>
          this.readJsonQueue<PendingR2Upload>(this.pendingUploadsFile)
        );
        const queuedCodes = new Set(pendingQueue.map((u) => u.code));

        let r2Set = knownR2Codes;
        if (!r2Set) {
          try {
            const r2Photos = await this.listR2Photos();
            r2Set = new Set(r2Photos.map((p) => p.code));
          } catch (err: any) {
            this.lastSyncError = err?.message || 'Cloud unreachable';
            return { synced: 0, failed: 0, remaining: pendingQueue.length };
          }
        }

        const localPhotos = await this.localBackup!.getAllPhotos();
        for (const localPhoto of localPhotos) {
          if (
            !r2Set.has(localPhoto.code) &&
            !queuedCodes.has(localPhoto.code) &&
            !(await this.localBackup!.isDeleted(localPhoto.code)) &&
            this.isFresh(localPhoto.createdAt)
          ) {
            pendingQueue.push({
              code: localPhoto.code,
              createdAt: localPhoto.createdAt,
              attempts: 0,
            });
            queuedCodes.add(localPhoto.code);
          }
        }

        if (pendingQueue.length === 0) {
          this.lastSyncError = null;
          return { synced: 0, failed: 0, remaining: 0 };
        }

        const completedUploadCodes = new Set<string>();
        const failedUploadMap = new Map<string, PendingR2Upload>();
        const CONCURRENCY = 2;
        for (let i = 0; i < pendingQueue.length; i += CONCURRENCY) {
          const batch = pendingQueue.slice(i, i + CONCURRENCY);
          await Promise.all(
            batch.map(async (entry) => {
              if (await this.localBackup!.isDeleted(entry.code)) {
                completedUploadCodes.add(entry.code);
                return;
              }
              if (r2Set!.has(entry.code)) {
                completedUploadCodes.add(entry.code);
                return;
              }
              const buf = await this.localBackup!.getPhotoBuffer(entry.code);
              if (!buf) {
                completedUploadCodes.add(entry.code); // Missing on disk (cleaned or expired); drop stale queue entry
                return;
              }
              try {
                const res = await this.request('PUT', `${entry.code}.jpg`, {
                  body: new Uint8Array(buf),
                  contentType: 'image/jpeg',
                  timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
                });
                if (res.ok) {
                  // Guard against PDPA delete arriving while PUT was in flight
                  if (await this.localBackup!.isDeleted(entry.code)) {
                    try {
                      const compRes = await this.request('DELETE', `${entry.code}.jpg`, { timeoutMs: 5000 });
                      if (!compRes.ok && compRes.status !== 404) {
                        await this.enqueueDelete(entry.code);
                      }
                    } catch {
                      await this.enqueueDelete(entry.code);
                    }
                    completedUploadCodes.add(entry.code);
                  } else {
                    synced += 1;
                    completedUploadCodes.add(entry.code);
                  }
                } else {
                  failed += 1;
                  failedUploadMap.set(entry.code, {
                    ...entry,
                    attempts: entry.attempts + 1,
                    lastAttemptAt: Date.now(),
                    lastError: `HTTP ${res.status}`,
                  });
                }
              } catch (err: any) {
                failed += 1;
                failedUploadMap.set(entry.code, {
                  ...entry,
                  attempts: entry.attempts + 1,
                  lastAttemptAt: Date.now(),
                  lastError: err?.message || 'Network error',
                });
              }
            })
          );
        }

        // Merge queue inside lock so concurrent savePhoto()/enqueueUpload() calls made mid-sync are never overwritten
        const finalRemainingCount = await this.withQueueLock(async () => {
          const latestQueue = await this.readJsonQueue<PendingR2Upload>(this.pendingUploadsFile);
          const merged = new Map<string, PendingR2Upload>();

          for (const item of latestQueue) {
            if (!completedUploadCodes.has(item.code) && !(await this.localBackup!.isDeleted(item.code))) {
              merged.set(item.code, item);
            }
          }
          for (const [code, failedEntry] of failedUploadMap.entries()) {
            if (!(await this.localBackup!.isDeleted(code))) {
              merged.set(code, failedEntry);
            }
          }

          const finalList = Array.from(merged.values());
          await this.writeJsonQueue(this.pendingUploadsFile, finalList);
          return finalList.length;
        });

        if (synced > 0) {
          this.lastSyncAt = Date.now();
          this.lastSyncedCount = synced;
        }
        this.lastSyncError = failed > 0 ? `${failed} upload(s) waiting for stable connection` : null;
        return { synced, failed, remaining: finalRemainingCount };
      } finally {
        this.activeSyncPromise = null;
      }
    })();

    return this.activeSyncPromise;
  }

  async savePhoto(shortCode: string, imageBuffer: Buffer): Promise<StoredPhotoResult> {
    const nowIso = new Date().toISOString();
    // 1. Dual-Write Safety Net: Always save locally first on laptop NVMe
    let savedToLocal = false;
    if (this.localBackup) {
      try {
        await this.localBackup.savePhoto(shortCode, imageBuffer);
        savedToLocal = true;
      } catch (err) {
        console.warn('Local NVMe backup save notice:', err);
      }
    }
    await this.removePendingDelete(shortCode);

    // 2. Upload to Cloudflare R2 with resilient offline fallback & queue persistence
    let savedToCloud = false;
    let cloudError = '';
    try {
      const res = await this.request('PUT', `${shortCode}.jpg`, {
        body: new Uint8Array(imageBuffer),
        contentType: 'image/jpeg',
        timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
      });
      if (res.ok) {
        savedToCloud = true;
        await this.removePendingUpload(shortCode);
        // Opportunistically flush any earlier offline backlog now that R2 succeeded
        void this.syncPendingToR2().catch(() => {});
      } else {
        cloudError = `HTTP ${res.status}`;
        console.warn(`R2 upload non-OK status: ${cloudError}`);
      }
    } catch (err: any) {
      cloudError = err?.name === 'AbortError' ? 'Timeout' : (err?.message || 'Offline');
      console.warn('R2 network upload offline/interrupted, preserved in local NVMe:', cloudError);
    }

    if (!savedToCloud && savedToLocal) {
      await this.enqueueUpload(shortCode, nowIso, cloudError || 'Offline');
    }

    // If both failed, then we must report an error
    if (!savedToCloud && !savedToLocal) {
      throw new Error('Photo storage failed: both cloud and local NVMe storage were unreachable');
    }

    return {
      photoId: shortCode,
      shortCode,
      url:
        savedToCloud && this.publicDomain
          ? `${this.publicDomain}/${shortCode}.jpg`
          : `/api/photos/${shortCode}/file`,
      storageDriver: savedToCloud ? 'r2' : 'local',
      expiresAt: new Date(Date.now() + RETENTION_MS).toISOString(),
    };
  }

  async getPhotoUrl(shortCode: string): Promise<string | null> {
    if (this.localBackup && (await this.localBackup.isDeleted(shortCode))) {
      return null;
    }

    try {
      const res = await this.request('HEAD', `${shortCode}.jpg`, { timeoutMs: PROBE_HTTP_TIMEOUT_MS });
      if (res.ok && this.isFresh(res.headers.get('last-modified'))) {
        if (this.publicDomain) {
          return `${this.publicDomain}/${shortCode}.jpg`;
        }
        return `/api/photos/${shortCode}/file`;
      }
    } catch {
      // Offline or R2 temporarily unreachable; fall back to local NVMe below
    }

    if (this.localBackup) {
      const localUrl = await this.localBackup.getPhotoUrl(shortCode).catch(() => null);
      if (localUrl) return localUrl;
    }

    return null;
  }

  async getPhotoBuffer(shortCode: string): Promise<Buffer | null> {
    if (this.localBackup && (await this.localBackup.isDeleted(shortCode))) {
      return null;
    }

    // 1. If available locally on kiosk laptop, serve with zero latency
    if (this.localBackup) {
      const localBuf = await this.localBackup.getPhotoBuffer(shortCode).catch(() => null);
      if (localBuf) return localBuf;
    }

    // 2. Otherwise fetch from Cloudflare R2
    try {
      const res = await this.request('GET', `${shortCode}.jpg`, { timeoutMs: DEFAULT_HTTP_TIMEOUT_MS });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 download failed: HTTP ${res.status}`);
      if (!this.isFresh(res.headers.get('last-modified'))) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      console.warn(`R2 buffer fetch failed for ${shortCode}:`, err);
      return null;
    }
  }

  async getAllPhotos(): Promise<PhotoRecord[]> {
    let r2Photos: PhotoRecord[] = [];
    let r2Ok = false;

    try {
      r2Photos = await this.listR2Photos();
      r2Ok = true;
    } catch (err) {
      console.warn('R2 list unavailable, serving local NVMe gallery fallback:', err);
    }

    if (!r2Ok && !this.localBackup) {
      throw new Error('R2 list failed and no local backup is configured');
    }

    const pendingDeletes = new Set((await this.readJsonQueue<PendingR2Delete>(this.pendingDeletesFile)).map((d) => d.code));
    const pendingUploads = new Set((await this.readJsonQueue<PendingR2Upload>(this.pendingUploadsFile)).map((u) => u.code));

    const localPhotos = this.localBackup ? await this.localBackup.getAllPhotos().catch(() => []) : [];
    const localMap = new Map<string, PhotoRecord>();
    for (const lp of localPhotos) {
      localMap.set(lp.code, lp);
    }

    const merged = new Map<string, PhotoRecord>();
    const r2Codes = new Set<string>();

    for (const rp of r2Photos) {
      if (pendingDeletes.has(rp.code)) continue;
      if (this.localBackup && (await this.localBackup.isDeleted(rp.code))) continue;
      r2Codes.add(rp.code);
      const localMatch = localMap.get(rp.code);
      merged.set(rp.code, {
        ...rp,
        // Preserve original local capture time if present on this machine so Day 1/Day 2 analytics don't drift on late sync
        createdAt: localMatch?.createdAt || rp.createdAt,
        expiresAt: localMatch?.expiresAt || rp.expiresAt,
        // When local machine has NVMe copy, /api/photos/[code]/file or publicDomain both work; UI uses onError fallback too
        pendingCloudSync: false,
        storageDriver: 'r2',
      });
    }

    let missingInR2Count = 0;
    for (const lp of localPhotos) {
      if (pendingDeletes.has(lp.code)) continue;
      if (!merged.has(lp.code)) {
        missingInR2Count += 1;
        merged.set(lp.code, {
          ...lp,
          photoUrl: `/api/photos/${lp.code}/file`,
          pendingCloudSync: true,
          storageDriver: 'local',
        });
      }
    }

    // Mark any leftover pending queue item cleanly even when offline
    for (const code of pendingUploads) {
      const existing = merged.get(code);
      if (existing && !r2Codes.has(code)) {
        existing.pendingCloudSync = true;
      }
    }

    // If R2 is reachable and local photos haven't synced to R2 yet, flush automatically in background!
    if (r2Ok && (missingInR2Count > 0 || pendingUploads.size > 0 || pendingDeletes.size > 0)) {
      void this.syncPendingToR2(r2Codes).catch(() => {});
    }

    const result = Array.from(merged.values());
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }

  async deletePhoto(shortCode: string): Promise<boolean> {
    await this.removePendingUpload(shortCode);
    if (this.localBackup) {
      await this.localBackup.deletePhoto(shortCode).catch(() => {});
    }
    try {
      const res = await this.request('DELETE', `${shortCode}.jpg`, { timeoutMs: 5000 });
      if (res.ok || res.status === 404) {
        await this.removePendingDelete(shortCode);
        return true;
      }
    } catch {
      // Offline: defer R2 deletion until internet returns
    }
    await this.enqueueDelete(shortCode);
    return true;
  }

  /**
   * Removes local backup .jpg cache ONLY for photos confirmed to exist on Cloudflare R2
   * and not waiting in pendingUploads. Keeps pending/offline photos safe on disk.
   */
  async clearSyncedLocalCache(): Promise<{ cleared: number; keptPending: number; error?: string }> {
    if (process.env.VERCEL || !this.localBackup) {
      return { cleared: 0, keptPending: 0 };
    }
    const localCodes = await this.localBackup.getLocalPhotoCodes();
    if (localCodes.length === 0) {
      return { cleared: 0, keptPending: 0 };
    }

    let r2Codes: Set<string>;
    try {
      const r2Photos = await this.listR2Photos();
      r2Codes = new Set(r2Photos.map((p) => p.code));
    } catch (err: any) {
      return {
        cleared: 0,
        keptPending: localCodes.length,
        error: err?.message || 'Cloud unreachable',
      };
    }

    const pendingQueue = await this.withQueueLock(() =>
      this.readJsonQueue<PendingR2Upload>(this.pendingUploadsFile)
    );
    const pendingSet = new Set(pendingQueue.map((u) => u.code));

    const safeToClear: string[] = [];
    let keptPending = 0;
    for (const code of localCodes) {
      if (r2Codes.has(code) && !pendingSet.has(code)) {
        safeToClear.push(code);
      } else {
        keptPending += 1;
      }
    }

    const cleared = safeToClear.length > 0 ? await this.localBackup.removeLocalCacheFiles(safeToClear) : 0;
    return { cleared, keptPending };
  }

  isExpired(createdAtIso: string): boolean {
    return !this.isFresh(createdAtIso);
  }
}
