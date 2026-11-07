import { CPEFrameTemplateId } from '../contracts';

/**
 * High-Precision Vector Canvas 2D Frame Renderers
 * Draws stunning 1440x1080 (4:3) frames with mathematical precision.
 * Guarantees razor-sharp vector rendering at any scale without external dependencies.
 */
export function drawFrameOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frameId: CPEFrameTemplateId
) {
  ctx.save();

  if (frameId === 'cpe-official') {
    // 1. SWU Official Classic Frame
    // Outer border
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#CE1126';
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Inner subtle hairline
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.strokeRect(32, 32, width - 64, height - 64);

    // Corner decorative accents
    const cornerSize = 48;
    ctx.fillStyle = '#CE1126';
    // Top-Left
    ctx.fillRect(16, 16, cornerSize, 6);
    ctx.fillRect(16, 16, 6, cornerSize);
    // Top-Right
    ctx.fillRect(width - 16 - cornerSize, 16, cornerSize, 6);
    ctx.fillRect(width - 22, 16, 6, cornerSize);
    // Bottom-Left
    ctx.fillRect(16, height - 22, cornerSize, 6);
    ctx.fillRect(16, height - 16 - cornerSize, 6, cornerSize);
    // Bottom-Right
    ctx.fillRect(width - 16 - cornerSize, height - 22, cornerSize, 6);
    ctx.fillRect(width - 22, height - 16 - cornerSize, 6, cornerSize);

    // Bottom Banner Plate
    const bannerHeight = 84;
    ctx.fillStyle = 'rgba(13, 17, 26, 0.92)';
    ctx.fillRect(34, height - 34 - bannerHeight, width - 68, bannerHeight);

    // Red divider line
    ctx.fillStyle = '#CE1126';
    ctx.fillRect(34, height - 34 - bannerHeight, width - 68, 4);

    // Logo Emblem Box
    ctx.fillStyle = '#CE1126';
    ctx.beginPath();
    ctx.arc(88, height - 34 - bannerHeight / 2, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SWU', 88, height - 34 - bannerHeight / 2);

    // Text details
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px "Plus Jakarta Sans", "Prompt", sans-serif';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText('SRINAKHARINWIROT UNIVERSITY', 132, height - 34 - bannerHeight / 2 - 10);

    ctx.font = '500 16px "Plus Jakarta Sans", "Prompt", sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('COMPUTER ENGINEERING • OPEN HOUSE 2026', 132, height - 34 - bannerHeight / 2 + 18);

    // Right badge
    ctx.textAlign = 'right';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillStyle = '#CE1126';
    ctx.fillText('ENGINEERING CPE', width - 56, height - 34 - bannerHeight / 2);

  } else if (frameId === 'cpe-tech-circuit') {
    // 2. CPE Tech Circuit / Cyberpunk Engineering Frame
    // Dark cyber border
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#0D111A';
    ctx.strokeRect(12, 12, width - 24, height - 24);

    // Neon Cyan & SWU Red Traces
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#06B6D4';
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 8;

    // Top-Left Circuit Traces
    ctx.beginPath();
    ctx.moveTo(30, 160);
    ctx.lineTo(30, 40);
    ctx.lineTo(160, 40);
    ctx.lineTo(190, 70);
    ctx.lineTo(320, 70);
    ctx.stroke();

    // Node dots
    ctx.fillStyle = '#06B6D4';
    ctx.beginPath();
    ctx.arc(320, 70, 6, 0, Math.PI * 2);
    ctx.arc(30, 160, 5, 0, Math.PI * 2);
    ctx.fill();

    // Top-Right Circuit Traces
    ctx.strokeStyle = '#CE1126';
    ctx.shadowColor = '#CE1126';
    ctx.beginPath();
    ctx.moveTo(width - 30, 160);
    ctx.lineTo(width - 30, 40);
    ctx.lineTo(width - 180, 40);
    ctx.lineTo(width - 210, 70);
    ctx.lineTo(width - 340, 70);
    ctx.stroke();

    ctx.fillStyle = '#CE1126';
    ctx.beginPath();
    ctx.arc(width - 340, 70, 6, 0, Math.PI * 2);
    ctx.arc(width - 30, 160, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0; // reset shadow

    // Bottom Tech HUD Bar
    const hudHeight = 76;
    ctx.fillStyle = 'rgba(6, 8, 13, 0.9)';
    ctx.fillRect(28, height - 28 - hudHeight, width - 56, hudHeight);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#06B6D4';
    ctx.strokeRect(28, height - 28 - hudHeight, width - 56, hudHeight);

    // Binary code background watermark
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.textAlign = 'left';
    ctx.fillText('01000011 01010000 01000101 // SWU_CPE_NEURAL_VISION_CORE // V4.2', 46, height - 28 - hudHeight + 24);

    // Main HUD title
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillStyle = '#06B6D4';
    ctx.fillText('CPE • AI PHOTO BOOTH', 46, height - 28 - hudHeight + 54);

    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#CE1126';
    ctx.textAlign = 'right';
    ctx.fillText('[ SYS_STATUS: OPERATIONAL ]', width - 46, height - 28 - hudHeight + 54);

  } else if (frameId === 'cpe-photostrip') {
    // 3. Minimalist Film Strip / Polaroid Frame
    // Wide Polar White Border (Outer margins)
    ctx.lineWidth = 28;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.95)';
    ctx.strokeRect(14, 14, width - 28, height - 28);

    // Bottom polaroid chin
    const chinHeight = 110;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
    ctx.fillRect(14, height - 14 - chinHeight, width - 28, chinHeight);

    // Subtle dark separator
    ctx.fillStyle = '#1E2536';
    ctx.fillRect(40, height - 14 - chinHeight, width - 80, 2);

    // Film Sprocket holes on top and bottom
    ctx.fillStyle = '#06080D';
    for (let x = 60; x < width - 60; x += 70) {
      // Top sprocket
      ctx.fillRect(x, 6, 24, 16);
    }

    // Text in black/slate on the white chin
    ctx.textAlign = 'left';
    ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#06080D';
    ctx.fillText('SWU OPEN HOUSE 2026', 48, height - 14 - chinHeight / 2 + 6);

    ctx.font = '500 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748B';
    ctx.fillText('COMPUTER ENGINEERING', 48, height - 14 - chinHeight / 2 + 30);

    // Date stamp in red retro digital font
    ctx.textAlign = 'right';
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillStyle = '#CE1126';
    ctx.fillText(`DATE: ${dateStr}`, width - 48, height - 14 - chinHeight / 2 + 10);
  }

  ctx.restore();
}
