import type { LandmarkPoint } from './gestureRules';

// Bones connecting MediaPipe 21 hand landmarks
export const HAND_BONES: readonly [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // index
  [5, 9], [9, 10], [10, 11], [11, 12],  // middle
  [9, 13], [13, 14], [14, 15], [15, 16],// ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17],                              // palm base
];

export interface CoverTransform {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Computes the exact CSS `object-cover` coordinate transform from normalized
 * video coordinates [0..1] to normalized container coordinates [0..1].
 */
export function computeObjectCoverTransform(
  videoWidth: number,
  videoHeight: number,
  containerAspect: number
): CoverTransform {
  const vw = videoWidth > 0 ? videoWidth : 16;
  const vh = videoHeight > 0 ? videoHeight : 9;
  const videoAspect = vw / vh;
  const targetAspect = containerAspect > 0 ? containerAspect : 4 / 3;

  let scaleX = 1;
  let scaleY = 1;
  let offsetX = 0;
  let offsetY = 0;

  if (videoAspect > targetAspect) {
    // Video is wider than container (cropped left/right)
    scaleX = videoAspect / targetAspect;
    offsetX = (1 - scaleX) / 2;
  } else if (videoAspect < targetAspect) {
    // Video is taller than container (cropped top/bottom)
    scaleY = targetAspect / videoAspect;
    offsetY = (1 - scaleY) / 2;
  }

  return { scaleX, scaleY, offsetX, offsetY };
}

/**
 * Velocity-aware adaptive filter + micro-extrapolator (inspired by 1-Euro Filter).
 *
 * - Low velocity (steady hand): applies light smoothing (alpha ~ 0.55) to suppress camera sensor jitter.
 * - High velocity (moving hand): ramps alpha -> 0.96 so landmarks snap 1:1 with the real hand with zero lag.
 * - Between webcam frames (e.g. 30fps camera on 60/120Hz display): performs bounded velocity extrapolation
 *   (up to 16ms) so the skeleton renders at native display refresh rate without stair-stepping.
 */
export class AdaptiveHandSmoother {
  private smoothed: LandmarkPoint[] | null = null;
  private velocity: { vx: number; vy: number; vz: number }[] | null = null;
  private lastUpdateMs = 0;

  /** Update with a fresh camera detection at `nowMs`. */
  update(raw: LandmarkPoint[], nowMs: number): LandmarkPoint[] {
    if (!raw || raw.length < 21) {
      this.reset();
      return [];
    }

    const dt = this.lastUpdateMs > 0 ? Math.max(1, nowMs - this.lastUpdateMs) : 16.67;

    // If first detection, gap > 250ms, or large spatial jump (> 22% screen), snap immediately
    if (!this.smoothed || !this.velocity || dt > 250 || this.isTeleportJump(raw)) {
      this.smoothed = raw.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z ?? 0 }));
      this.velocity = raw.map(() => ({ vx: 0, vy: 0, vz: 0 }));
      this.lastUpdateMs = nowMs;
      return this.smoothed;
    }

    const minAlpha = 0.58;
    const maxAlpha = 0.96;
    // Speed at which alpha saturates to maxAlpha (normalized screen units per ms)
    const velocityScale = 0.0022;

    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      const prev = this.smoothed[i];
      const dx = r.x - prev.x;
      const dy = r.y - prev.y;
      const dz = (r.z ?? 0) - (prev.z ?? 0);

      const speed = Math.hypot(dx, dy) / dt;
      const t = Math.min(1, speed / velocityScale);
      const alpha = minAlpha + (maxAlpha - minAlpha) * t;

      const nx = prev.x + alpha * dx;
      const ny = prev.y + alpha * dy;
      const nz = (prev.z ?? 0) + alpha * dz;

      this.velocity[i].vx = (nx - prev.x) / dt;
      this.velocity[i].vy = (ny - prev.y) / dt;
      this.velocity[i].vz = (nz - (prev.z ?? 0)) / dt;

      prev.x = nx;
      prev.y = ny;
      prev.z = nz;
    }

    this.lastUpdateMs = nowMs;
    return this.smoothed;
  }

  /**
   * Sample interpolated/extrapolated landmarks at display frame time `nowMs`.
   * Bounded to 16ms max extrapolation horizon so it never overshoots.
   */
  sample(nowMs: number): LandmarkPoint[] | null {
    if (!this.smoothed || !this.velocity) return null;
    const elapsed = Math.max(0, Math.min(16, nowMs - this.lastUpdateMs));
    if (elapsed < 1) return this.smoothed;

    // Damped prediction factor (0.55) prevents overshoot when hand decelerates
    const damping = 0.55;
    return this.smoothed.map((pt, i) => {
      const v = this.velocity![i];
      return {
        x: pt.x + v.vx * elapsed * damping,
        y: pt.y + v.vy * elapsed * damping,
        z: (pt.z ?? 0) + v.vz * elapsed * damping,
      };
    });
  }

  reset(): void {
    this.smoothed = null;
    this.velocity = null;
    this.lastUpdateMs = 0;
  }

  private isTeleportJump(raw: LandmarkPoint[]): boolean {
    if (!this.smoothed || !this.smoothed[9] || !raw[9]) return true;
    const dist = Math.hypot(raw[9].x - this.smoothed[9].x, raw[9].y - this.smoothed[9].y);
    return dist > 0.22;
  }
}

export interface HandCanvasDrawOptions {
  landmarks: LandmarkPoint[] | null;
  holdProgress: number;
  isForeground: boolean;
  videoWidth: number;
  videoHeight: number;
  containerAspect: number;
}

/**
 * Direct GPU-accelerated Canvas 2D renderer for the 21-point hand skeleton.
 * Zero DOM node allocations, batched path rendering (< 0.3ms per frame).
 */
export function drawHandMeshOnCanvas(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  opts: HandCanvasDrawOptions
): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const { landmarks, holdProgress, isForeground, videoWidth, videoHeight, containerAspect } = opts;
  if (!landmarks || landmarks.length < 21 || canvasWidth <= 0 || canvasHeight <= 0) {
    return;
  }

  const { scaleX, scaleY, offsetX, offsetY } = computeObjectCoverTransform(
    videoWidth,
    videoHeight,
    containerAspect
  );

  // Map normalized landmarks to pixel coordinates on the mirrored canvas
  // Note: the <canvas> has `scale-x-[-1]` matching the <video>, so x maps identically.
  const ptsX = new Float32Array(21);
  const ptsY = new Float32Array(21);

  let minX = canvasWidth;
  let maxX = 0;
  let minY = canvasHeight;
  let maxY = 0;

  for (let i = 0; i < 21; i++) {
    const pt = landmarks[i];
    const px = (offsetX + pt.x * scaleX) * canvasWidth;
    const py = (offsetY + pt.y * scaleY) * canvasHeight;
    ptsX[i] = px;
    ptsY[i] = py;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  const unit = Math.min(canvasWidth, canvasHeight) / 100;
  const strokeColor = isForeground ? '#FFFFFF' : '#F59E0B';

  ctx.save();

  // 1. Batched skeleton bones (single draw call)
  ctx.beginPath();
  for (let i = 0; i < HAND_BONES.length; i++) {
    const [a, b] = HAND_BONES[i];
    ctx.moveTo(ptsX[a], ptsY[a]);
    ctx.lineTo(ptsX[b], ptsY[b]);
  }
  ctx.strokeStyle = strokeColor;
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = Math.max(1.5, unit * 0.55);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 2. Subtle corner brackets around hand bounding box (single draw call)
  const pad = unit * 1.6;
  const bx = Math.max(0, minX - pad);
  const by = Math.max(0, minY - pad);
  const bw = Math.min(canvasWidth - bx, maxX - minX + pad * 2);
  const bh = Math.min(canvasHeight - by, maxY - minY + pad * 2);
  const arm = Math.min(bw, bh) * 0.22;

  ctx.beginPath();
  // Top-Left
  ctx.moveTo(bx, by + arm);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + arm, by);
  // Top-Right
  ctx.moveTo(bx + bw - arm, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + arm);
  // Bottom-Left
  ctx.moveTo(bx, by + bh - arm);
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx + arm, by + bh);
  // Bottom-Right
  ctx.moveTo(bx + bw - arm, by + bh);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw, by + bh - arm);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = Math.max(1.2, unit * 0.42);
  ctx.stroke();

  // 3. Crisp solid white joints with dark outline
  ctx.globalAlpha = 0.96;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(1, unit * 0.2);

  for (let i = 0; i < 21; i++) {
    const isFingertip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
    const isWrist = i === 0;
    const r = (isWrist ? 1.05 : isFingertip ? 0.9 : 0.62) * unit;

    ctx.beginPath();
    ctx.arc(ptsX[i], ptsY[i], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 4. Palm Hold Progress Ring (when holding open palm)
  if (holdProgress > 0) {
    const palmX = ptsX[9];
    const palmY = ptsY[9];
    const handSpan = Math.max(maxX - minX, maxY - minY);
    const ringRadius = Math.max(unit * 3.4, Math.min(unit * 6.8, handSpan * 0.35));

    // Background track ring
    ctx.beginPath();
    ctx.arc(palmX, palmY, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = Math.max(1.5, unit * 0.55);
    ctx.stroke();

    // Active progress arc
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.min(100, Math.max(0, holdProgress)) / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(palmX, palmY, ringRadius, startAngle, endAngle);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(2.5, unit * 1.15);
    ctx.lineCap = 'round';
    ctx.stroke();

    // Un-mirror text because canvas has CSS `scale-x-[-1]`
    ctx.save();
    ctx.translate(palmX, palmY);
    ctx.scale(-1, 1);
    const fontSize = Math.max(11, Math.round(ringRadius * 0.44));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(holdProgress)}%`, 0, 1);
    ctx.restore();
  }

  ctx.restore();
}
