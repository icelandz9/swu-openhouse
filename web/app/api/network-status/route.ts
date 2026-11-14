import { NextRequest, NextResponse } from 'next/server';
import {
  probeCloudConnectivity,
  getCloudSyncStatus,
  syncCloudStorageNow,
  clearSyncedLocalCache,
} from '@/lib/storage/storageService';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const probe = await probeCloudConnectivity();
  let syncStatus = await getCloudSyncStatus();

  const shouldSync =
    probe.online &&
    (syncStatus.pendingUploads > 0 ||
      syncStatus.pendingDeletes > 0 ||
      req.nextUrl.searchParams.get('sync') === '1');

  // Kick off background R2 reconciliation without blocking the health poll response
  if (shouldSync && !syncStatus.syncing) {
    void syncCloudStorageNow().catch(() => {});
    syncStatus = await getCloudSyncStatus();
  }

  return NextResponse.json(
    {
      online: probe.online,
      cloudReachable: probe.online,
      latencyMs: probe.latencyMs,
      error: probe.error ?? null,
      ...syncStatus,
      timestamp: Date.now(),
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  let action = 'sync';
  try {
    const body = await req.json();
    if (body && typeof body.action === 'string') {
      action = body.action;
    }
  } catch {
    // Empty body defaults to 'sync'
  }

  const probe = await probeCloudConnectivity();
  if (!probe.online) {
    const syncStatus = await getCloudSyncStatus();
    return NextResponse.json(
      {
        online: false,
        cloudReachable: false,
        latencyMs: null,
        error: probe.error ?? 'Offline',
        syncResult: { synced: 0, failed: syncStatus.pendingUploads, remaining: syncStatus.pendingUploads },
        ...syncStatus,
        timestamp: Date.now(),
      },
      { headers: CORS_HEADERS }
    );
  }

  if (action === 'clear_local_cache') {
    const cacheClearResult = await clearSyncedLocalCache();
    const syncStatus = await getCloudSyncStatus();
    return NextResponse.json(
      {
        online: true,
        cloudReachable: true,
        latencyMs: probe.latencyMs,
        error: cacheClearResult.error ?? null,
        cacheClearResult,
        ...syncStatus,
        timestamp: Date.now(),
      },
      { headers: CORS_HEADERS }
    );
  }

  const syncResult = await syncCloudStorageNow();
  const syncStatus = await getCloudSyncStatus();

  return NextResponse.json(
    {
      online: true,
      cloudReachable: true,
      latencyMs: probe.latencyMs,
      error: null,
      syncResult,
      ...syncStatus,
      timestamp: Date.now(),
    },
    { headers: CORS_HEADERS }
  );
}
