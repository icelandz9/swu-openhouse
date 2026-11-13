import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

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
  };
}

const DEFAULT_SYNC_STATE: KioskSyncState = {
  config: {
    countdownSeconds: 3,
    handAreaThreshold: 0.025,
    photoRatio: 'frame',
    isPaused: false,
    publicDomain: '',
    updatedAt: 0,
  },
  lastCommand: null,
  telemetry: {},
};

// Shared file in repo root /tmp or data so even if Port 3000 and Port 3001 are both running, they share the same state file!
function getSharedSyncFilePath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), '..', '..', '..', 'web', 'data'),
  ];
  // Use a single canonical file if the main repo web/data exists, otherwise local data/
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

let memoryState: KioskSyncState = structuredClone(DEFAULT_SYNC_STATE);

function readSyncState(): KioskSyncState {
  try {
    const filePath = getSharedSyncFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<KioskSyncState>;
      memoryState = {
        config: { ...DEFAULT_SYNC_STATE.config, ...(parsed.config || {}) },
        lastCommand: parsed.lastCommand || null,
        telemetry: { ...memoryState.telemetry, ...(parsed.telemetry || {}) },
      };
    }
  } catch {}
  return memoryState;
}

function writeSyncState(next: KioskSyncState): void {
  memoryState = next;
  try {
    const filePath = getSharedSyncFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(next), 'utf-8');
  } catch {}
}

export async function GET() {
  const state = readSyncState();
  return NextResponse.json(state, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = readSyncState();
    const now = Date.now();

    // 1. Handle command from /admin
    if (body && typeof body.command === 'string') {
      const cmd = body.command;
      const val = body.value;
      const cmdId = typeof body.id === 'string' ? body.id : `${now}-${Math.random().toString(36).slice(2, 8)}`;

      current.lastCommand = {
        id: cmdId,
        command: cmd,
        value: val,
        timestamp: now,
      };

      // Also persist sticky config changes
      if (cmd === 'SET_COUNTDOWN' && typeof val === 'number' && val >= 1 && val <= 15) {
        current.config.countdownSeconds = val;
        current.config.updatedAt = now;
      } else if (cmd === 'SET_THRESHOLD' && typeof val === 'number' && val >= 0.005 && val <= 0.1) {
        current.config.handAreaThreshold = val;
        current.config.updatedAt = now;
      } else if (cmd === 'SET_PHOTO_RATIO' && (val === 'frame' || val === '4:3' || val === '3:4')) {
        current.config.photoRatio = val === '4:3' ? '4:3' : 'frame';
        current.config.updatedAt = now;
      } else if (cmd === 'PAUSE_BOOTH') {
        current.config.isPaused = true;
        current.config.updatedAt = now;
      } else if (cmd === 'RESUME_BOOTH' || cmd === 'RESET_STANDBY' || cmd === 'STAFF_TRIGGER') {
        current.config.isPaused = false;
        current.config.updatedAt = now;
      } else if (cmd === 'SET_PUBLIC_DOMAIN' && typeof val === 'string') {
        current.config.publicDomain = val.trim();
        current.config.updatedAt = now;
      }

      writeSyncState(current);
      return NextResponse.json({ ok: true, state: current });
    }

    // 2. Handle telemetry report from /kiosk
    if (body && body.telemetry && body.telemetry.kiosk) {
      current.telemetry.kiosk = {
        ...body.telemetry.kiosk,
        lastSeen: now,
      };
      writeSyncState(current);
      return NextResponse.json({ ok: true, state: current });
    }

    return NextResponse.json({ ok: true, state: current });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Invalid payload' }, { status: 400 });
  }
}
