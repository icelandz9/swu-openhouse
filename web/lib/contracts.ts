// Shared TypeScript Contracts for SWU Open House Photo Booth
// Screen 1: Kiosk (/kiosk)
// Screen 2: Display Showcase (/display)
// Screen 3: Staff Admin Portal (/admin)
// Screen 4: Mobile Editor (/p/[code]) & Lookup (/find)

export type GestureType = "OPEN_PALM" | "FIST" | "PEACE_SIGN" | "MINI_HEART" | "NONE";

export type KioskFSMState =
  | "IDLE"
  | "DETECTING_HAND"
  | "COUNTDOWN_ACTIVE"
  | "FLASH_CAPTURE"
  | "PREVIEW_RETAKE"
  | "UPLOADING"
  | "WAITING_NETWORK"
  | "RESET_COOLDOWN";

// Kiosk timing specifications
export const KIOSK_TIMING = {
  holdToTriggerMs: 1500, // 1.5s palm hold starts countdown
  countdownSeconds: 3, // 3..2..1 pose freely
  flashMs: 150,
  previewSeconds: 10, // 10s review: Fist = retake (unlimited per DoD-2), Palm = proceed
  maxRetakes: Infinity, // Unlimited retakes per DoD-2
} as const;

// Default production URL for QR code generation when phones scan from 4G/5G
export const DEFAULT_PRODUCTION_APP_URL = 'https://cpe-swu-openhouse.vercel.app';

// Inter-Screen Event Bus Contract (BroadcastChannel: 'swu_photobooth_bus')
export const SCREEN_SYNC_CHANNEL = "swu_photobooth_bus" as const;

export type ScreenSyncEvent =
  | {
      type: "PHOTO_READY_FOR_DISPLAY";
      code: string;
      qrUrl: string;
      photoUrl: string;
      createdAt: string;
      token?: string;
    }
  | {
      type: "PHOTO_DELETED";
      code: string;
    }
  | {
      type: "SCREEN1_RESET";
    }
  | {
      type: "STAFF_TRIGGER_CAPTURE";
    }
  | {
      type: "MUTE_DISPLAY";
    }
  | {
      type: "UNMUTE_DISPLAY";
    }
  | {
      type: "PUSH_TO_DISPLAY";
      photo: PhotoRecord;
    }
  | {
      type: "HEARTBEAT_PING";
      sender: "ADMIN" | "KIOSK" | "DISPLAY";
      timestamp: number;
    }
  | {
      type: "HEARTBEAT_PONG";
      sender: "KIOSK" | "DISPLAY";
      timestamp: number;
      pingTimestamp?: number;
      status?: Record<string, any>;
    }
  | {
      type: "KIOSK_COMMAND";
      command:
        | "RESET_STANDBY"
        | "SKIP_PREVIEW"
        | "PAUSE_BOOTH"
        | "RESUME_BOOTH"
        | "RELOAD_CAMERA"
        | "CANCEL_COUNTDOWN"
        | "SET_THRESHOLD"
        | "SET_COUNTDOWN"
        | "MUTE_DISPLAY"
        | "UNMUTE_DISPLAY"
        | string;
      value?: any;
    };

// 1. Hand Detection State
export interface HandDetectionState {
  isCameraReady: boolean;
  cameraError: string | null;
  isHandPresent: boolean;
  detectedGesture: GestureType;
  confidence: number;
  holdDurationMs: number; // 0 to 1500 ms
  holdProgress: number; // 0 to 100%
  isTriggerReady: boolean; // true when gesture held continuously for required duration
}

// 2. Output from POST /api/photos
export interface UploadPhotoResponse {
  code: string; // e.g., "OPH-AB29"
  qrUrl: string; // e.g., "http://192.168.1.10:3000/p/OPH-AB29"
  photoUrl: string; // e.g., "/api/photos/OPH-AB29"
  token?: string;
  createdAt: string; // ISO 8601 timestamp
  expiresAt: string; // ISO 8601 timestamp (+7 days PDPA TTL)
}

// 3. Metadata Record for Staff Admin Portal (/admin) & Photo Lookup (/find)
export interface PhotoRecord {
  code: string;
  photoUrl: string;
  qrUrl: string;
  token?: string;
  createdAt: string;
  expiresAt: string;
}

// 4. Mobile Color Filter & CPE Frame Template Definitions
export type FilterPresetId =
  | "original"
  | "warm"
  | "cool"
  | "vintage"
  | "bw"
  | "rosy";

export type CPEFrameTemplateId =
  | "cpe-official"
  | "cpe-tech-circuit"
  | "cpe-photostrip"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "14"
  | "15"
  | string;

export interface StoredPhotoResult {
  photoId: string;
  shortCode: string;
  url: string;
  storageDriver: "local" | "r2";
  expiresAt: string;
}

// 5. Photo Capture Specifications
// Default capture ratio; staff can switch to 3:4 in /admin (sent to the kiosk as SET_PHOTO_RATIO)
export type PhotoRatio = '4:3' | '3:4';
export const PHOTO_ASPECT_RATIO: PhotoRatio = '4:3';
export const CROP_DIMENSIONS_3_4 = { width: 1080, height: 1440 } as const; // 3:4 portrait: fills the 1080x1440 frames, but keeps only ~42% of the camera's width
export const CROP_DIMENSIONS_4_3 = { width: 1440, height: 1080 } as const; // 4:3 landscape (default): keeps 75% of the camera's width
