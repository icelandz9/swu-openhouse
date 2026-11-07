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
  previewSeconds: 10, // 10s review: Fist = retake, Palm = proceed
  maxRetakes: 1,
} as const;

// Inter-Screen Event Bus Contract (BroadcastChannel: 'swu_photobooth_bus')
export const SCREEN_SYNC_CHANNEL = "swu_photobooth_bus" as const;

export type ScreenSyncEvent =
  | {
      type: "PHOTO_READY_FOR_DISPLAY";
      code: string;
      qrUrl: string;
      photoUrl: string;
      createdAt: string;
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
      type: "KIOSK_COMMAND";
      command: "RESET_STANDBY" | "SKIP_PREVIEW" | "PAUSE_BOOTH" | "RESUME_BOOTH" | string;
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
  createdAt: string; // ISO 8601 timestamp
  expiresAt: string; // ISO 8601 timestamp (+7 days PDPA TTL)
}

// 3. Metadata Record for Staff Admin Portal (/admin) & Photo Lookup (/find)
export interface PhotoRecord {
  code: string;
  photoUrl: string;
  qrUrl: string;
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
  | "cpe-photostrip";

export interface StoredPhotoResult {
  photoId: string;
  shortCode: string;
  url: string;
  storageDriver: "local" | "r2";
  expiresAt: string;
}

// 5. Photo Capture Specifications
export const PHOTO_ASPECT_RATIO = "4:3" as const;
export const CROP_DIMENSIONS_4_3 = { width: 1440, height: 1080 } as const; // Center-crop from 1920x1080 webcam stream
