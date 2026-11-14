import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getR2Adapter } from '@/lib/storage/storageService';
import { isValidShortCode } from '@/lib/mobile/shortCodeGenerator';
import { isHostAllowed } from '@/lib/security/photoToken';

export const dynamic = 'force-dynamic';

// Maximum allowed detection range = 1.5 meters (corresponds to >= 2.5% bounding box area)
const MIN_HAND_THRESHOLD = 0.025;
const MAX_HAND_THRESHOLD = 0.10;
const REMOTE_CONTROL_KEY = '_system/kiosk-control.json';
const REMOTE_KIOSK_TEL_KEY = '_system/kiosk-telemetry.json';
const REMOTE_DISPLAY_TEL_KEY = '_system/display-telemetry.json';
const REMOTE_PULL_COOLDOWN_MS = 950;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export interface SyncPhotoPayload {
  code: string;
  photoUrl: string;
  qrUrl: string;
  createdAt: string;
  token?: string;
}

export interface KioskSyncState {
  config: {
    countdownSeconds: number;
    handAreaThreshold: number;
    photoRatio: 'frame' | '4:3';
    isPaused: boolean;
    publicDomain: string;
    updatedAt: number;
  };
  lastCommand: {
    id: string;
    command: string;
    value?: any;
    timestamp: number;
  } | null;
  displayAction: {
    id: string;
    type: 'PUSH_TO_DISPLAY' | 'RESET_STANDBY' | 'PHOTO_READY';
    photo?: SyncPhotoPayload;
    timestamp: number;
  } | null;
  displayMuted: boolean;
  displayUpdatedAt: number;
  lastDeleted: {
    id: string;
    code: string;
    timestamp: number;
  } | null;
  telemetry: {
    kiosk?: {
      fps: number;
      resolution: string;
      aiLatencyMs: number;
      state: string;
      cameraActive: boolean;
      isPaused: boolean;
      threshold: number;
      countdownSeconds: number;
      photoRatio: string;
      handAreaPct?: number;
      lastSeen: number;
    };
    display?: {
      activeCode: string | null;
      queueLength: number;
      totalPhotos: number;
      isMuted: boolean;
      latencyMs?: number;
      lastSeen: number;
    };
  };
}

const DEFAULT_SYNC_STATE: KioskSyncState = {
  config: {
    countdownSeconds: 3,
    handAreaThreshold: MIN_HAND_THRESHOLD,
    photoRatio: 'frame',
    isPaused: false,
    publicDomain: '',
    updatedAt: 0,
  },
  lastCommand: null,
  displayAction: null,
  displayMuted: false,
  displayUpdatedAt: 0,
  lastDeleted: null,
  telemetry: {},
};

function clampHandThreshold(val: unknown): number {
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (!Number.isFinite(num)) return MIN_HAND_THRESHOLD;
  return Math.max(MIN_HAND_THRESHOLD, Math.min(MAX_HAND_THRESHOLD, num));
}

function getSharedSyncFilePath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), '..', '..', '..', 'web', 'data'),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir)) {
        return path.join(dir, 'kiosk-sync.json');
      }
    } catch {}
  }
  const fallbackDir = path.resolve(process.cwd(), 'data');
  try {
    fs.mkdirSync(fallbackDir, { recursive: true });
  } catch {}
  return path.join(fallbackDir, 'kiosk-sync.json');
}

const globalForSync = globalThis as typeof globalThis & {
  __boothSyncState?: KioskSyncState;
  __lastRemoteSyncPullAt?: number;
};

function normalizeState(raw?: Partial<KioskSyncState>): KioskSyncState {
  const cfg = { ...DEFAULT_SYNC_STATE.config, ...(raw?.config || {}) };
  cfg.handAreaThreshold = clampHandThreshold(cfg.handAreaThreshold);
  return {
    config: cfg,
    lastCommand: raw?.lastCommand || null,
    displayAction: raw?.displayAction || null,
    displayMuted: Boolean(raw?.displayMuted),
    displayUpdatedAt: typeof raw?.displayUpdatedAt === 'number' ? raw.displayUpdatedAt : 0,
    lastDeleted: raw?.lastDeleted || null,
    telemetry: {
      ...(raw?.telemetry || {}),
    },
  };
}

function readSyncState(): KioskSyncState {
  if (!globalForSync.__boothSyncState) {
    globalForSync.__boothSyncState = structuredClone(DEFAULT_SYNC_STATE);
  }
  try {
    const filePath = getSharedSyncFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<KioskSyncState>;
      globalForSync.__boothSyncState = normalizeState({
        ...parsed,
        telemetry: {
          ...globalForSync.__boothSyncState.telemetry,
          ...(parsed.telemetry || {}),
        },
      });
    }
  } catch {}
  return globalForSync.__boothSyncState;
}

function writeSyncState(next: KioskSyncState): void {
  const normalized = normalizeState(next);
  globalForSync.__boothSyncState = normalized;
  if (process.env.VERCEL) return;
  try {
    const filePath = getSharedSyncFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(normalized), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch {}
}

function buildRemoteControlPayload(state: KioskSyncState) {
  return {
    config: state.config,
    lastCommand: state.lastCommand,
    displayAction: state.displayAction,
    displayMuted: state.displayMuted,
    displayUpdatedAt: state.displayUpdatedAt,
    lastDeleted: state.lastDeleted,
  };
}

function isSafeRelativeOrHttpUrl(url: unknown): url is string {
  return typeof url === 'string' && /^(\/|https?:\/\/)/i.test(url.trim());
}

/** Pulls cross-machine state from Cloudflare R2 (disjoint keys prevent telemetry from overwriting commands). */
async function mergeFromCloud(current: KioskSyncState): Promise<KioskSyncState> {
  const r2 = getR2Adapter();
  if (!r2) return current;

  const now = Date.now();
  if (globalForSync.__lastRemoteSyncPullAt && now - globalForSync.__lastRemoteSyncPullAt < REMOTE_PULL_COOLDOWN_MS) {
    return current;
  }
  globalForSync.__lastRemoteSyncPullAt = now;

  try {
    const [remoteControl, remoteKioskTel, remoteDisplayTel] = await Promise.all([
      r2.readRemoteJson<Partial<KioskSyncState>>(REMOTE_CONTROL_KEY),
      r2.readRemoteJson<{ kiosk?: KioskSyncState['telemetry']['kiosk'] }>(REMOTE_KIOSK_TEL_KEY),
      r2.readRemoteJson<{ display?: KioskSyncState['telemetry']['display'] }>(REMOTE_DISPLAY_TEL_KEY),
    ]);

    // Re-read fresh local state after awaits so concurrent local POSTs are never overwritten
    const latestLocal = readSyncState();
    let changed = false;
    const next = normalizeState(latestLocal);

    if (remoteControl) {
      if ((remoteControl.config?.updatedAt || 0) > next.config.updatedAt && remoteControl.config) {
        const candidateDomain = typeof remoteControl.config.publicDomain === 'string'
          ? remoteControl.config.publicDomain.trim()
          : '';
        next.config = {
          ...next.config,
          ...remoteControl.config,
          publicDomain: !candidateDomain || isHostAllowed(candidateDomain) ? candidateDomain : next.config.publicDomain,
          handAreaThreshold: clampHandThreshold(remoteControl.config.handAreaThreshold),
        };
        changed = true;
      }
      if (
        remoteControl.lastCommand?.id &&
        typeof remoteControl.lastCommand.timestamp === 'number' &&
        remoteControl.lastCommand.timestamp > (next.lastCommand?.timestamp || 0)
      ) {
        next.lastCommand = remoteControl.lastCommand;
        changed = true;
      }
      if ((remoteControl.displayUpdatedAt || 0) > next.displayUpdatedAt) {
        next.displayUpdatedAt = remoteControl.displayUpdatedAt!;
        next.displayMuted = Boolean(remoteControl.displayMuted);
        if (remoteControl.displayAction !== undefined) {
          next.displayAction = remoteControl.displayAction;
        }
        changed = true;
      }
      if (
        remoteControl.lastDeleted &&
        (!next.lastDeleted || remoteControl.lastDeleted.timestamp > next.lastDeleted.timestamp)
      ) {
        next.lastDeleted = remoteControl.lastDeleted;
        changed = true;
      }
      if (
        remoteControl.telemetry?.kiosk &&
        remoteControl.telemetry.kiosk.lastSeen > (next.telemetry.kiosk?.lastSeen || 0)
      ) {
        next.telemetry.kiosk = remoteControl.telemetry.kiosk;
        changed = true;
      }
    }

    if (
      remoteKioskTel?.kiosk &&
      remoteKioskTel.kiosk.lastSeen > (next.telemetry.kiosk?.lastSeen || 0)
    ) {
      next.telemetry.kiosk = remoteKioskTel.kiosk;
      changed = true;
    }

    if (
      remoteDisplayTel?.display &&
      remoteDisplayTel.display.lastSeen > (next.telemetry.display?.lastSeen || 0)
    ) {
      next.telemetry.display = remoteDisplayTel.display;
      changed = true;
    }

    if (changed) {
      writeSyncState(next);
    }
    return next;
  } catch {
    return current;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  let state = readSyncState();
  // Cross-machine pull: query R2 when rate limit permits (or explicitly requested by display)
  if (req.nextUrl.searchParams.get('cloud') !== '0') {
    state = await mergeFromCloud(state);
  }
  return NextResponse.json(state, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const current = readSyncState();
    const now = Date.now();
    const r2 = getR2Adapter();
    let mirrorControlToR2 = false;
    let mirrorKioskTelToR2 = false;
    let mirrorDisplayTelToR2 = false;

    // 1. Handle command from /admin or /kiosk
    if (body && typeof body.command === 'string') {
      const cmd = body.command;
      const val = body.value;
      const cmdId = typeof body.id === 'string' ? body.id : `${now}-${Math.random().toString(36).slice(2, 8)}`;

      // Display-only / gallery notifications should not re-trigger kiosk shutter/reset commands unnecessarily
      const isDisplayOnlyCmd =
        cmd === 'PUSH_TO_DISPLAY' ||
        cmd === 'MUTE_DISPLAY' ||
        cmd === 'UNMUTE_DISPLAY' ||
        cmd === 'PHOTO_READY' ||
        cmd === 'PHOTO_DELETED';

      if (cmd === 'SET_PUBLIC_DOMAIN' && typeof val === 'string') {
        const cleanDomain = val.trim();
        if (cleanDomain && !isHostAllowed(cleanDomain)) {
          return NextResponse.json(
            { ok: false, error: 'Untrusted publicDomain host' },
            { status: 400, headers: CORS_HEADERS }
          );
        }
        current.config.publicDomain = cleanDomain;
        current.config.updatedAt = now;
        mirrorControlToR2 = true;
      } else if (cmd === 'PUSH_TO_DISPLAY') {
        const rawCode = typeof val?.code === 'string' ? val.code.trim().toUpperCase() : '';
        if (!isValidShortCode(rawCode)) {
          return NextResponse.json({ ok: false, error: 'Invalid short code' }, { status: 400, headers: CORS_HEADERS });
        }
        current.displayMuted = false;
        current.displayAction = {
          id: cmdId,
          type: 'PUSH_TO_DISPLAY',
          photo: {
            code: rawCode,
            photoUrl: isSafeRelativeOrHttpUrl(val.photoUrl) ? val.photoUrl.trim() : `/api/photos/${rawCode}/file`,
            qrUrl: isSafeRelativeOrHttpUrl(val.qrUrl) ? val.qrUrl.trim() : `/p/${rawCode}`,
            createdAt: typeof val.createdAt === 'string' ? val.createdAt : new Date(now).toISOString(),
            token: typeof val.token === 'string' ? val.token : undefined,
          },
          timestamp: now,
        };
        current.displayUpdatedAt = now;
        mirrorControlToR2 = true;
      } else if (cmd === 'PHOTO_READY') {
        const rawCode = typeof val?.code === 'string' ? val.code.trim().toUpperCase() : '';
        if (!isValidShortCode(rawCode)) {
          return NextResponse.json({ ok: false, error: 'Invalid short code' }, { status: 400, headers: CORS_HEADERS });
        }
        current.displayAction = {
          id: cmdId,
          type: 'PHOTO_READY',
          photo: {
            code: rawCode,
            photoUrl: isSafeRelativeOrHttpUrl(val.photoUrl) ? val.photoUrl.trim() : `/api/photos/${rawCode}/file`,
            qrUrl: isSafeRelativeOrHttpUrl(val.qrUrl) ? val.qrUrl.trim() : `/p/${rawCode}`,
            createdAt: typeof val.createdAt === 'string' ? val.createdAt : new Date(now).toISOString(),
            token: typeof val.token === 'string' ? val.token : undefined,
          },
          timestamp: now,
        };
        current.displayUpdatedAt = now;
        mirrorControlToR2 = true;
      } else if (cmd === 'PHOTO_DELETED' && typeof val === 'string') {
        const rawCode = val.trim().toUpperCase();
        if (!isValidShortCode(rawCode)) {
          return NextResponse.json({ ok: false, error: 'Invalid short code' }, { status: 400, headers: CORS_HEADERS });
        }
        current.lastDeleted = {
          id: cmdId,
          code: rawCode,
          timestamp: now,
        };
        if (current.displayAction?.photo?.code === rawCode) {
          current.displayAction = {
            id: cmdId,
            type: 'RESET_STANDBY',
            timestamp: now,
          };
          current.displayUpdatedAt = now;
        }
        mirrorControlToR2 = true;
      } else if (cmd === 'SET_COUNTDOWN' && typeof val === 'number' && val >= 1 && val <= 15) {
        current.config.countdownSeconds = val;
        current.config.updatedAt = now;
        mirrorControlToR2 = true;
      } else if (cmd === 'SET_THRESHOLD') {
        current.config.handAreaThreshold = clampHandThreshold(val);
        current.config.updatedAt = now;
        mirrorControlToR2 = true;
      } else if (cmd === 'SET_PHOTO_RATIO' && (val === 'frame' || val === '4:3' || val === '3:4')) {
        current.config.photoRatio = val === '4:3' ? '4:3' : 'frame';
        current.config.updatedAt = now;
        mirrorControlToR2 = true;
      } else if (cmd === 'PAUSE_BOOTH') {
        current.config.isPaused = true;
        current.config.updatedAt = now;
        mirrorControlToR2 = true;
      } else if (cmd === 'RESUME_BOOTH' || cmd === 'STAFF_TRIGGER') {
        current.config.isPaused = false;
        current.config.updatedAt = now;
        mirrorControlToR2 = true;
      } else if (cmd === 'RESET_STANDBY') {
        current.config.isPaused = false;
        current.config.updatedAt = now;
        current.displayAction = {
          id: cmdId,
          type: 'RESET_STANDBY',
          timestamp: now,
        };
        current.displayUpdatedAt = now;
        mirrorControlToR2 = true;
      } else if (cmd === 'MUTE_DISPLAY') {
        current.displayMuted = true;
        current.displayUpdatedAt = now;
        mirrorControlToR2 = true;
      } else if (cmd === 'UNMUTE_DISPLAY') {
        current.displayMuted = false;
        current.displayUpdatedAt = now;
        mirrorControlToR2 = true;
      }

      if (!isDisplayOnlyCmd) {
        current.lastCommand = {
          id: cmdId,
          command: cmd,
          value: val,
          timestamp: now,
        };
        mirrorControlToR2 = true;
      }

      writeSyncState(current);
      if (mirrorControlToR2 && r2) {
        const remotePayload = buildRemoteControlPayload(current);
        if (isDisplayOnlyCmd || cmd === 'RESET_STANDBY' || cmd === 'SET_PUBLIC_DOMAIN') {
          await r2.writeRemoteJson(REMOTE_CONTROL_KEY, remotePayload).catch(() => false);
        } else {
          void r2.writeRemoteJson(REMOTE_CONTROL_KEY, remotePayload).catch(() => false);
        }
      }

      return NextResponse.json({ ok: true, state: current }, { headers: CORS_HEADERS });
    }

    // 2. Handle telemetry report from /kiosk or /display (stored under disjoint keys so telemetry never clobbers commands)
    if (body && body.telemetry) {
      if (body.telemetry.kiosk) {
        current.telemetry.kiosk = {
          ...body.telemetry.kiosk,
          threshold: clampHandThreshold(body.telemetry.kiosk.threshold),
          lastSeen: now,
        };
        mirrorKioskTelToR2 = true;
      }
      if (body.telemetry.display) {
        current.telemetry.display = {
          ...body.telemetry.display,
          lastSeen: now,
        };
        mirrorDisplayTelToR2 = true;
      }

      writeSyncState(current);

      if (r2) {
        if (mirrorKioskTelToR2 && current.telemetry.kiosk) {
          void r2
            .writeRemoteJson(REMOTE_KIOSK_TEL_KEY, {
              kiosk: current.telemetry.kiosk,
            })
            .catch(() => false);
        }
        if (mirrorDisplayTelToR2 && current.telemetry.display) {
          void r2
            .writeRemoteJson(REMOTE_DISPLAY_TEL_KEY, {
              display: current.telemetry.display,
            })
            .catch(() => false);
        }
      }

      return NextResponse.json({ ok: true, state: current }, { headers: CORS_HEADERS });
    }

    return NextResponse.json({ ok: true, state: current }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Invalid payload' },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
