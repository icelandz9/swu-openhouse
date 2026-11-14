import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CloudflareR2Adapter } from './CloudflareR2Adapter';

async function runOfflineRecoveryIntegrationTest() {
  const origCwd = process.cwd();
  const origFetch = globalThis.fetch;
  const origVercel = process.env.VERCEL;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'swu-r2-test-'));

  let r2Online = false;
  let slowPutDelayMs = 0;
  let onPutInFlight: ((key: string) => Promise<void> | void) | null = null;
  const r2Objects = new Map<string, { body: Buffer; lastModified: string }>();
  const r2Calls: Array<{ method: string; url: string }> = [];

  try {
    delete process.env.VERCEL;
    process.chdir(tempRoot);

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method || 'GET').toUpperCase();
      r2Calls.push({ method, url });

      if (!r2Online) {
        throw new Error('ECONNREFUSED simulated internet outage');
      }

      const parsed = new URL(url);
      // path format: /<bucket>/<key?>
      const segments = parsed.pathname.split('/').filter(Boolean);
      const key = segments.slice(1).join('/');

      if (method === 'GET' && !key) {
        const blocks = Array.from(r2Objects.entries())
          .map(
            ([k, v]) =>
              `<Contents><Key>${k}</Key><LastModified>${v.lastModified}</LastModified></Contents>`
          )
          .join('');
        const xml = `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><IsTruncated>false</IsTruncated>${blocks}</ListBucketResult>`;
        return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml' } });
      }

      if (method === 'PUT' && key) {
        if (onPutInFlight) {
          const hook = onPutInFlight;
          onPutInFlight = null;
          await hook(key);
        }
        if (slowPutDelayMs > 0) {
          await new Promise((r) => setTimeout(r, slowPutDelayMs));
        }
        if (!r2Online) {
          throw new Error('ECONNREFUSED simulated mid-upload drop');
        }
        const bodyBuf = init?.body ? Buffer.from(init.body as Uint8Array) : Buffer.alloc(0);
        r2Objects.set(key, { body: bodyBuf, lastModified: new Date().toISOString() });
        return new Response('', { status: 200 });
      }

      if (method === 'HEAD' && key) {
        const obj = r2Objects.get(key);
        if (!obj) return new Response(null, { status: 404 });
        return new Response(null, { status: 200, headers: { 'last-modified': obj.lastModified } });
      }

      if (method === 'GET' && key) {
        const obj = r2Objects.get(key);
        if (!obj) return new Response('Not found', { status: 404 });
        return new Response(new Uint8Array(obj.body), {
          status: 200,
          headers: { 'content-type': 'image/jpeg', 'last-modified': obj.lastModified },
        });
      }

      if (method === 'DELETE' && key) {
        const existed = r2Objects.delete(key);
        return new Response(null, { status: existed ? 204 : 404 });
      }

      return new Response('Unhandled mock route', { status: 400 });
    }) as typeof fetch;

    const adapter = new CloudflareR2Adapter();
    const fakeJpeg1 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const fakeJpeg2 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 6]);

    // Seed an "already synced yesterday" object on R2 to verify delete-while-offline propagates when back online
    r2Objects.set('OPH-2DEL.jpg', {
      body: fakeJpeg2,
      lastModified: new Date().toISOString(),
    });

    // Phase 1: Internet is OFFLINE
    const offlineProbe = await adapter.probeCloud();
    assert.equal(offlineProbe.online, false);
    assert.equal(offlineProbe.latencyMs, null);

    // Save two photos while internet is down -> must succeed locally and enqueue uploads
    const res1 = await adapter.savePhoto('OPH-OFF1', fakeJpeg1);
    const res2 = await adapter.savePhoto('OPH-OFF2', fakeJpeg2);
    assert.equal(res1.storageDriver, 'local');
    assert.equal(res1.url, '/api/photos/OPH-OFF1/file');
    assert.equal(res2.storageDriver, 'local');

    // Delete OPH-2DEL and OPH-OFF2 while offline -> OPH-OFF2 unqueued, OPH-2DEL queued in deletes
    await adapter.deletePhoto('OPH-OFF2');
    await adapter.deletePhoto('OPH-2DEL');

    const statusOffline = await adapter.getSyncStatus();
    assert.equal(statusOffline.pendingUploads, 1);
    assert.deepEqual(statusOffline.pendingCodes, ['OPH-OFF1']);
    assert.equal(statusOffline.pendingDeletes, 2); // OPH-OFF2 and OPH-2DEL deferred delete

    // Gallery read offline MUST NOT throw and must show OPH-OFF1 as pendingCloudSync=true
    const galleryOffline = await adapter.getAllPhotos();
    assert.equal(galleryOffline.length, 1);
    assert.equal(galleryOffline[0].code, 'OPH-OFF1');
    assert.equal(galleryOffline[0].pendingCloudSync, true);
    assert.equal(galleryOffline[0].storageDriver, 'local');

    // Local image fallback & buffer work seamlessly offline
    assert.equal(await adapter.getPhotoUrl('OPH-OFF1'), '/api/photos/OPH-OFF1/file');
    const diskBuf = await adapter.getPhotoBuffer('OPH-OFF1');
    assert.ok(diskBuf && diskBuf.equals(fakeJpeg1));
    assert.equal(await adapter.getPhotoBuffer('OPH-2DEL'), null);

    // Phase 2: Internet RECOVERS
    r2Online = true;
    const onlineProbe = await adapter.probeCloud();
    assert.equal(onlineProbe.online, true);
    assert.ok((onlineProbe.latencyMs ?? 0) >= 1);

    // Trigger simultaneous calls to verify single-flight deduplication
    const [syncA, syncB] = await Promise.all([adapter.syncPendingToR2(), adapter.syncPendingToR2()]);
    assert.equal(syncA.synced, 1);
    assert.equal(syncB.synced, 1); // Same in-flight promise
    assert.equal(syncA.failed, 0);
    assert.equal(syncA.remaining, 0);

    // Verify OPH-OFF1 uploaded & OPH-2DEL deleted from R2
    assert.ok(r2Objects.has('OPH-OFF1.jpg'));
    assert.ok(!r2Objects.has('OPH-OFF2.jpg'));
    assert.ok(!r2Objects.has('OPH-2DEL.jpg'));

    // Second sync call must be a clean no-op
    const syncIdempotent = await adapter.syncPendingToR2();
    assert.equal(syncIdempotent.synced, 0);
    assert.equal(syncIdempotent.remaining, 0);

    const statusAfter = await adapter.getSyncStatus();
    assert.equal(statusAfter.pendingUploads, 0);
    assert.equal(statusAfter.pendingDeletes, 0);

    // Gallery after sync preserves photo cleanly with r2 driver
    const galleryOnline = await adapter.getAllPhotos();
    assert.equal(galleryOnline.length, 1);
    assert.equal(galleryOnline[0].code, 'OPH-OFF1');
    assert.equal(galleryOnline[0].storageDriver, 'r2');
    assert.equal(galleryOnline[0].pendingCloudSync, false);

    // Phase 3: Cross-machine system JSON writeRemoteJson / readRemoteJson
    r2Objects.set('_system/kiosk-control.json', {
      body: Buffer.from(JSON.stringify({ ok: true, ping: 123 })),
      lastModified: new Date().toISOString(),
    });
    const sysJson = await adapter.readRemoteJson<{ ok: boolean; ping: number }>('_system/kiosk-control.json');
    assert.deepEqual(sysJson, { ok: true, ping: 123 });

    // Phase 4: Queue races & 404 delete cleanup
    // 4a. Deferred DELETE where object already returned 404 on R2 must NOT stay stuck in pendingDeletes
    r2Online = false;
    await adapter.deletePhoto('OPH-404Z');
    r2Online = true;
    await adapter.syncPendingToR2();
    const statusAfter404 = await adapter.getSyncStatus();
    assert.equal(statusAfter404.pendingDeletes, 0, '404 DELETE on R2 must clear pendingDeletes');

    // 4b. Concurrent savePhoto enqueued while syncPendingToR2 is mid-PUT must NOT be overwritten
    r2Online = false;
    await adapter.savePhoto('OPH-MID1', fakeJpeg1);
    r2Online = true;
    onPutInFlight = async (key) => {
      if (key === 'OPH-MID1.jpg') {
        r2Online = false; // Concurrent save occurs during offline flicker
        await adapter.savePhoto('OPH-MID2', fakeJpeg2);
        r2Online = true;
      }
    };
    await adapter.syncPendingToR2();
    const statusAfterRace = await adapter.getSyncStatus();
    assert.ok(
      statusAfterRace.pendingCodes.includes('OPH-MID2'),
      `OPH-MID2 saved during syncPendingToR2 must stay queued (got ${JSON.stringify(statusAfterRace.pendingCodes)})`
    );
    await adapter.syncPendingToR2();
    assert.ok(r2Objects.has('OPH-MID2.jpg'), 'OPH-MID2 must flush cleanly on subsequent sync');

    // 4c. PDPA delete called while PUT for the same photo is in flight must NOT leave photo resurrected on R2
    r2Online = false;
    await adapter.savePhoto('OPH-PDPA', fakeJpeg1);
    r2Online = true;
    onPutInFlight = async (key) => {
      if (key === 'OPH-PDPA.jpg') {
        await adapter.deletePhoto('OPH-PDPA');
      }
    };
    await adapter.syncPendingToR2();
    assert.ok(!r2Objects.has('OPH-PDPA.jpg'), 'PDPA delete mid-PUT must not leave photo live on R2');
  } finally {
    globalThis.fetch = origFetch;
    if (origVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = origVercel;
    process.chdir(origCwd);
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

runOfflineRecoveryIntegrationTest()
  .then(() => {
    console.log('r2OfflineQueue: offline fallback, deferred delete, single-flight R2 sync & system JSON tests passed');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
