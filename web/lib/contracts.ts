// Shared TypeScript Contracts for the 3-Person Development Team
// Dev 1: AI & Computer Vision (web/lib/ai-vision/)
// Dev 2: Kiosk Frontend & FSM (web/app/kiosk/, web/lib/kiosk/)
// Dev 3: Mobile Editor, Storage & Staff Admin (web/app/p/, web/app/admin/, web/app/api/, web/lib/mobile/, web/lib/storage/)

export type GestureType = "OPEN_PALM" | "PEACE_SIGN" | "MINI_HEART" | "NONE";

export type KioskFSMState =
  | "IDLE"
  | "DETECTING_HAND"
  | "COUNTDOWN_ACTIVE"
  | "FLASH_CAPTURE"
  | "PREVIEW_RETAKE"
  | "UPLOADING"
  | "WAITING_NETWORK"
  | "SHOW_QR_CLEAN"
  | "RESET_COOLDOWN";

// 1. Output from Dev 1 (AI Vision Hook) -> Input to Dev 2 (Kiosk UI)
export interface HandDetectionState {
  isCameraReady: boolean;
  cameraError: string | null;
  isHandPresent: boolean;
  detectedGesture: GestureType;
  confidence: number;
  holdDurationMs: number; // 0 to 1500 ms
  holdProgress: number; // 0 to 100%
  isTriggerReady: boolean; // true when Open Palm held continuously for 1.5s
}

// 2. Output from Dev 3 (POST /api/photos) -> Input to Dev 2 (Clean QR Screen)
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

// 5. Photo Capture Specifications
export const PHOTO_ASPECT_RATIO = "4:3" as const;
export const CROP_DIMENSIONS_4_3 = { width: 1440, height: 1080 } as const; // Center-crop from 1920x1080 webcam stream

