// Shared TypeScript Contracts for the 3-Person Development Team
// Dev 1: AI & Computer Vision (web/lib/ai-vision/)
// Dev 2: Kiosk Frontend & FSM (web/app/kiosk/, web/app/display/, web/lib/kiosk/)
// Dev 3: Mobile Editor, Storage & Staff Admin (web/app/p/, web/app/admin/, web/app/api/, web/lib/mobile/, web/lib/storage/)

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

// Inter-Screen Event Bus Contract (BroadcastChannel: 'swu_photobooth_bus')
export type ScreenSyncEvent =
  | {
      type: "PHOTO_READY_FOR_DISPLAY";
      code: string;
      qrUrl: string;
      photoUrl: string;
      createdAt: string;
    }
  | {
      type: "SCREEN1_RESET";
    };

// 1. Output from Dev 1 (AI Vision Hook) -> Input to Dev 2 (Kiosk UI)
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

// 2. Output from Dev 3 (POST /api/photos) -> Input to Dev 2 (Sent to Screen 2)
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
