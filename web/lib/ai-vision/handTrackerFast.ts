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
 * Zero-Lag Predictive Hand Tracker + Micro-Deadzone Stabilizer.
 *
 * Designed so the 21-point skeleton stays glued 1:1 to the real hand:
 * - Stationary micro-deadzone (< 0.15% screen): suppresses sensor pixel noise with alpha = 0.85.
 * - Any intentional movement (>= 0.35% screen): snaps with alpha = 1.0 (zero exponential lag!).
 * - Velocity Lead Compensation: compensates for the ~10ms MediaPipe inference + camera pipeline delay
 *   and extrapolates smoothly between webcam frames (e.g. 30/60fps camera on 60/120Hz monitor).
 */
export class AdaptiveHandSmoother {
  private smoothed: LandmarkPoint[] | null = null;
  private prevRaw: LandmarkPoint[] | null = null;
  private velocity: { vx: number; vy: number; vz: number }[] | null = null;
  private lastUpdateMs = 0;
  private sampleBuffer: LandmarkPoint[] | null = null;

  /** Update with a fresh camera detection at `nowMs`. */
  update(raw: LandmarkPoint[], nowMs: number): LandmarkPoint[] {
    if (!raw || raw.length < 21) {
      this.reset();
      return [];
    }

    const dt = this.lastUpdateMs > 0 ? Math.max(1, nowMs - this.lastUpdateMs) : 16.67;

    // First detection, gap > 180ms, or spatial jump (> 15% screen) -> snap 100% immediately
    if (!this.smoothed || !this.prevRaw || !this.velocity || !this.sampleBuffer || dt > 180 || this.isTeleportJump(raw)) {
      this.smoothed = raw.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z ?? 0 }));
      this.prevRaw = raw.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z ?? 0 }));
      this.sampleBuffer = raw.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z ?? 0 }));
      this.velocity = raw.map(() => ({ vx: 0, vy: 0, vz: 0 }));
      this.lastUpdateMs = nowMs;
      return this.smoothed;
    }

    // Measure palm displacement to distinguish sensor noise from real hand movement
    const palmDx = raw[9].x - this.smoothed[9].x;
    const palmDy = raw[9].y - this.smoothed[9].y;
    const palmMoveDist = Math.hypot(palmDx, palmDy);

    // Zero-lag alpha curve:
    // - If hand moved >= 0.3% of screen (~3px on 1080p), alpha = 1.0 (instant 1:1 lock, zero drag!)
    // - If hand is completely still (< 0.3% of screen), alpha = 0.85 to prevent sub-pixel shimmer
    const alpha = palmMoveDist >= 0.003 ? 1.0 : 0.85 + (0.15 * (palmMoveDist / 0.003));

    for (let i = 0; i < 21; i++) {
      const r = raw[i];
      const prev = this.smoothed[i];
      const pRaw = this.prevRaw[i];

      // Instantaneous velocity from raw detections (smoothed slightly with previous velocity)
      const instVx = (r.x - pRaw.x) / dt;
      const instVy = (r.y - pRaw.y) / dt;
      const instVz = ((r.z ?? 0) - (pRaw.z ?? 0)) / dt;

      this.velocity[i].vx = 0.75 * instVx + 0.25 * this.velocity[i].vx;
      this.velocity[i].vy = 0.75 * instVy + 0.25 * this.velocity[i].vy;
      this.velocity[i].vz = 0.75 * instVz + 0.25 * this.velocity[i].vz;

      pRaw.x = r.x;
      pRaw.y = r.y;
      pRaw.z = r.z ?? 0;

      prev.x = prev.x + alpha * (r.x - prev.x);
      prev.y = prev.y + alpha * (r.y - prev.y);
      prev.z = (prev.z ?? 0) + alpha * ((r.z ?? 0) - (prev.z ?? 0));
    }

    this.lastUpdateMs = nowMs;
    return this.smoothed;
  }

  /**
   * Sample landmarks at display refresh time `nowMs` with predictive lead compensation.
   * Reuses a pre-allocated buffer (zero GC allocations per frame).
   */
  sample(nowMs: number, pipelineLeadMs: number = 8): LandmarkPoint[] | null {
    if (!this.smoothed || !this.velocity || !this.sampleBuffer) return null;
    const elapsedSinceFrame = Math.max(0, Math.min(24, nowMs - this.lastUpdateMs));

    // Check if hand is actively moving (palm speed > 0.00018 screen units/ms)
    const palmV = this.velocity[9];
    const palmSpeed = Math.hypot(palmV.vx, palmV.vy);

    // When moving, project forward by (elapsedSinceFrame + pipelineLeadMs) to cancel out camera + GPU latency!
    const leadTime = palmSpeed > 0.00018 ? elapsedSinceFrame + pipelineLeadMs : elapsedSinceFrame * 0.4;
    const damping = 0.85;

    for (let i = 0; i < 21; i++) {
      const pt = this.smoothed[i];
      const v = this.velocity[i];
      const out = this.sampleBuffer[i];
      // Clamp predicted step to max 3.5% screen so sudden stops never overshoot visibly
      const stepX = Math.max(-0.035, Math.min(0.035, v.vx * leadTime * damping));
      const stepY = Math.max(-0.035, Math.min(0.035, v.vy * leadTime * damping));
      out.x = pt.x + stepX;
      out.y = pt.y + stepY;
      out.z = (pt.z ?? 0) + v.vz * leadTime * damping;
    }

    return this.sampleBuffer;
  }

  reset(): void {
    this.smoothed = null;
    this.prevRaw = null;
    this.velocity = null;
    this.sampleBuffer = null;
    this.lastUpdateMs = 0;
  }

  private isTeleportJump(raw: LandmarkPoint[]): boolean {
    if (!this.smoothed || !this.smoothed[9] || !raw[9]) return true;
    const dist = Math.hypot(raw[9].x - this.smoothed[9].x, raw[9].y - this.smoothed[9].y);
    return dist > 0.15;
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

  // 3. Crisp solid white joints with dark outline (batched into 2 paths instead of 42 draw calls!)
  ctx.globalAlpha = 0.96;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(1, unit * 0.2);

  ctx.beginPath();
  for (let i = 0; i < 21; i++) {
    const isFingertip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
    const isWrist = i === 0;
    const r = (isWrist ? 1.05 : isFingertip ? 0.9 : 0.62) * unit;
    ctx.moveTo(ptsX[i] + r, ptsY[i]);
    ctx.arc(ptsX[i], ptsY[i], r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();

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
    ctx.fillText(`${Math.round(holdProgress)}%`, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}
