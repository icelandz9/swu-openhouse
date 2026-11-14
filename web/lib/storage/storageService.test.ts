import assert from 'node:assert/strict';
import { getR2Adapter } from './storageService';
import { CloudflareR2Adapter } from './CloudflareR2Adapter';

const g = globalThis as typeof globalThis & {
  __boothStorageInstance?: unknown;
  __boothStorageVersion?: number;
};

const origDriver = process.env.STORAGE_DRIVER;
const origAcc = process.env.R2_ACCOUNT_ID;
const origKey = process.env.R2_ACCESS_KEY_ID;
const origSec = process.env.R2_SECRET_ACCESS_KEY;
const origBkt = process.env.R2_BUCKET_NAME;

try {
  process.env.STORAGE_DRIVER = 'r2';
  process.env.R2_ACCOUNT_ID = 'acc_test';
  process.env.R2_ACCESS_KEY_ID = 'key_test';
  process.env.R2_SECRET_ACCESS_KEY = 'sec_test';
  process.env.R2_BUCKET_NAME = 'bkt_test';

  // Simulate a stale singleton created before a Next.js dev HMR reload
  g.__boothStorageInstance = { staleHmrInstance: true };
  g.__boothStorageVersion = 1;

  const adapter = getR2Adapter();
  assert.ok(adapter instanceof CloudflareR2Adapter, 'getR2Adapter must replace stale HMR singleton instead of returning null');
  console.log('storageService: stale HMR singleton recovery test passed');
} finally {
  delete g.__boothStorageInstance;
  delete g.__boothStorageVersion;
  if (origDriver === undefined) delete process.env.STORAGE_DRIVER;
  else process.env.STORAGE_DRIVER = origDriver;
  if (origAcc === undefined) delete process.env.R2_ACCOUNT_ID;
  else process.env.R2_ACCOUNT_ID = origAcc;
  if (origKey === undefined) delete process.env.R2_ACCESS_KEY_ID;
  else process.env.R2_ACCESS_KEY_ID = origKey;
  if (origSec === undefined) delete process.env.R2_SECRET_ACCESS_KEY;
  else process.env.R2_SECRET_ACCESS_KEY = origSec;
  if (origBkt === undefined) delete process.env.R2_BUCKET_NAME;
  else process.env.R2_BUCKET_NAME = origBkt;
}
