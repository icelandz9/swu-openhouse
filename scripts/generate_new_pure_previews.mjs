import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const brainDir = 'C:/Users/satit/.gemini/antigravity/brain/e8cf40fb-311f-4066-aa48-0e4da4416106';
const newImgPath = path.join(brainDir, '.user_uploaded/media_1794236085139_5fd28269.jpg');
const b64 = fs.readFileSync(newImgPath).toString('base64');
const dataUri = `data:image/jpeg;base64,${b64}`;

// 21 Landmarks precisely matching the hand in media_1794236085139_5fd28269.jpg (width: 1024, height: 576)
// Normalized to 0 - 100 percentage
const P = {
  0: [55.66, 90.28], // Wrist
  1: [44.92, 75.52], // Thumb CMC
  2: [40.53, 66.84], // Thumb MCP
  3: [37.89, 58.16], // Thumb IP
  4: [36.91, 48.96], // Thumb Tip

  5: [45.12, 57.29], // Index MCP
  6: [42.77, 44.27], // Index PIP
  7: [41.02, 32.12], // Index DIP
  8: [39.84, 19.97], // Index Tip

  9: [48.83, 54.69], // Middle MCP
  10: [47.36, 39.93], // Middle PIP
  11: [46.09, 25.17], // Middle DIP
  12: [44.73, 11.81], // Middle Tip

  13: [52.54, 54.69], // Ring MCP
  14: [51.95, 40.80], // Ring PIP
  15: [50.98, 27.78], // Ring DIP
  16: [49.61, 15.97], // Ring Tip

  17: [55.86, 58.16], // Pinky MCP
  18: [56.45, 46.01], // Pinky PIP
  19: [56.64, 33.85], // Pinky DIP
  20: [56.45, 22.22], // Pinky Tip
};

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [9, 13], [13, 14], [14, 15], [15, 16],// Ring
  [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [0, 17],                              // Palm Base
];

function renderLines(stroke, width, extra = '') {
  return BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" ${extra} />`).join('\n');
}

// 10 Pure Landmark & Tracking Styles
const STYLES = [
  {
    id: 1,
    key: 'cpe_crimson',
    title: 'CPE TACTICAL CRIMSON HUD',
    thaiTitle: 'แบบที่ 1: แดงวิศวะ CPE แทคติคอล (CPE Crimson Dual-Rail)',
    color: '#CE1126',
    renderSvg: () => `
      <defs>
        <filter id="glow1" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.45" flood-color="#CE1126" flood-opacity="0.9" />
        </filter>
      </defs>
      <!-- Dual Rail Bones: Crimson + Laser Core -->
      <g stroke="#CE1126" stroke-width="0.95" stroke-linecap="round" filter="url(#glow1)">
        ${renderLines('#CE1126', 0.95)}
      </g>
      <g stroke="#FFFFFF" stroke-width="0.25" stroke-linecap="round">
        ${renderLines('#FFFFFF', 0.25)}
      </g>
      <!-- Crosshair Nodes -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        const isWrist = Number(i) === 0;
        if (isWrist) {
          return `
            <g transform="translate(${x}, ${y})">
              <polygon points="0,-1.8 1.8,0 0,1.8 -1.8,0" fill="#CE1126" stroke="#FFFFFF" stroke-width="0.3" filter="url(#glow1)" />
              <circle cx="0" cy="0" r="0.6" fill="#FFFFFF" />
            </g>
          `;
        }
        return `
          <g transform="translate(${x}, ${y})">
            <line x1="-0.9" y1="0" x2="0.9" y2="0" stroke="#FFFFFF" stroke-width="0.22" />
            <line x1="0" y1="-0.9" x2="0" y2="0.9" stroke="#FFFFFF" stroke-width="0.22" />
            <circle cx="0" cy="0" r="${isTip ? 1.05 : 0.6}" fill="${isTip ? '#FFFFFF' : '#CE1126'}" stroke="#CE1126" stroke-width="0.2" filter="url(#glow1)" />
            ${isTip ? `<circle cx="0" cy="0" r="1.6" fill="none" stroke="#CE1126" stroke-width="0.2" stroke-dasharray="0.6 0.6" />` : ''}
          </g>
        `;
      }).join('\n')}
    `
  },
  {
    id: 2,
    key: 'cyber_neon',
    title: 'CYBERPUNK NEON AQUA',
    thaiTitle: 'แบบที่ 2: นีออนไซไฟไฮเทค (Cyberpunk Cyan Pulse)',
    color: '#00F5FF',
    renderSvg: () => `
      <defs>
        <filter id="glow2" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.8" flood-color="#00F5FF" flood-opacity="0.95" />
          <feDropShadow dx="0" dy="0" stdDeviation="0.25" flood-color="#FFFFFF" flood-opacity="0.9" />
        </filter>
      </defs>
      <!-- Neon Laser Bones -->
      <g stroke="#00F5FF" stroke-width="0.95" stroke-linecap="round" filter="url(#glow2)">
        ${renderLines('#00F5FF', 0.95)}
      </g>
      <g stroke="#FFFFFF" stroke-width="0.28" stroke-linecap="round">
        ${renderLines('#FFFFFF', 0.28)}
      </g>
      <!-- Glowing Orbs -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <g transform="translate(${x}, ${y})" filter="url(#glow2)">
            ${isTip ? `
              <circle cx="0" cy="0" r="1.8" fill="none" stroke="#00F5FF" stroke-width="0.25" stroke-dasharray="0.7 0.7" />
              <circle cx="0" cy="0" r="1.1" fill="#FFFFFF" stroke="#00F5FF" stroke-width="0.3" />
            ` : `
              <circle cx="0" cy="0" r="0.75" fill="#00F5FF" stroke="#FFFFFF" stroke-width="0.25" />
            `}
          </g>
        `;
      }).join('\n')}
    `
  },
  {
    id: 3,
    key: 'minimalist_wireframe',
    title: 'MINIMALIST BAUHAUS & DOTS',
    thaiTitle: 'แบบที่ 3: มินิมอลเรียบหรู (Apple Clean Wireframe)',
    color: '#FFFFFF',
    renderSvg: () => `
      <!-- Pure White Wireframe Lines -->
      <g stroke="rgba(255,255,255,0.75)" stroke-width="0.5" stroke-linecap="round">
        ${renderLines('rgba(255,255,255,0.75)', 0.5)}
      </g>
      <!-- Sharp Clean Dots -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <circle cx="${x}" cy="${y}" r="${isTip ? 0.95 : 0.6}" fill="#FFFFFF" stroke="#000000" stroke-width="0.18" />
        `;
      }).join('\n')}
    `
  },
  {
    id: 4,
    key: 'arc_reactor',
    title: 'IRON MAN REPULSOR CONDUITS',
    thaiTitle: 'แบบที่ 4: เตาปฏิกรณ์มาร์เวล (Iron Man Energy Conduits)',
    color: '#F59E0B',
    renderSvg: () => `
      <defs>
        <filter id="glow4" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.55" flood-color="#F59E0B" flood-opacity="0.85" />
          <feDropShadow dx="0" dy="0" stdDeviation="0.2" flood-color="#22D3EE" flood-opacity="0.8" />
        </filter>
      </defs>
      <!-- Golden Energy Conduits with Cyan Core -->
      <g stroke="#F59E0B" stroke-width="0.9" stroke-linecap="round" filter="url(#glow4)">
        ${renderLines('#F59E0B', 0.9)}
      </g>
      <g stroke="#22D3EE" stroke-width="0.28" stroke-linecap="round">
        ${renderLines('#22D3EE', 0.28)}
      </g>
      <!-- Repulsor Micro-Coils -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <g transform="translate(${x}, ${y})">
            ${isTip ? `
              <circle cx="0" cy="0" r="1.6" fill="none" stroke="#22D3EE" stroke-width="0.25" stroke-dasharray="0.8 0.5" />
              <circle cx="0" cy="0" r="1.0" fill="#F59E0B" stroke="#FFFFFF" stroke-width="0.25" filter="url(#glow4)" />
              <circle cx="0" cy="0" r="0.4" fill="#FFFFFF" />
            ` : `
              <circle cx="0" cy="0" r="0.65" fill="#22D3EE" stroke="#FFFFFF" stroke-width="0.2" filter="url(#glow4)" />
            `}
          </g>
        `;
      }).join('\n')}
    `
  },
  {
    id: 5,
    key: 'biometric_heatmap',
    title: 'BIOMETRIC HEATMAP GRADIENT',
    thaiTitle: 'แบบที่ 5: สเปกตรัมความร้อน (Biometric Depth Heatmap)',
    color: '#10B981',
    renderSvg: () => `
      <defs>
        <linearGradient id="heatGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38BDF8" />
          <stop offset="30%" stop-color="#10B981" />
          <stop offset="65%" stop-color="#FBBF24" />
          <stop offset="100%" stop-color="#EF4444" />
        </linearGradient>
      </defs>
      <!-- Thermal Spectral Bones -->
      <g stroke="url(#heatGrad)" stroke-width="0.95" stroke-linecap="round">
        ${renderLines('url(#heatGrad)', 0.95)}
      </g>
      <!-- Depth-Coded Joints -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        const color = y < 25 ? '#38BDF8' : y < 45 ? '#10B981' : y < 70 ? '#FBBF24' : '#EF4444';
        return `
          <circle cx="${x}" cy="${y}" r="${isTip ? 1.05 : 0.65}" fill="${color}" stroke="#FFFFFF" stroke-width="0.2" />
        `;
      }).join('\n')}
    `
  },
  {
    id: 6,
    key: 'constellation_stars',
    title: 'CONSTELLATION STAR MAP',
    thaiTitle: 'แบบที่ 6: กลุ่มดาวจักรวาลวิศวกรรม (Starlight Filaments)',
    color: '#A855F7',
    renderSvg: () => `
      <defs>
        <filter id="glow6" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.5" flood-color="#A855F7" flood-opacity="0.85" />
          <feDropShadow dx="0" dy="0" stdDeviation="0.2" flood-color="#FFFFFF" flood-opacity="0.9" />
        </filter>
      </defs>
      <!-- Cosmic Starlight Filaments -->
      <g stroke="#C084FC" stroke-width="0.65" stroke-linecap="round" stroke-dasharray="2.5 0.7" filter="url(#glow6)">
        ${renderLines('#C084FC', 0.65)}
      </g>
      <!-- 4-Pointed Sparkle Stars on Joints -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        const scale = isTip ? 1.3 : 0.8;
        return `
          <g transform="translate(${x}, ${y}) scale(${scale})" filter="url(#glow6)">
            <path d="M 0,-1.6 Q 0,0 1.6,0 Q 0,0 0,1.6 Q 0,0 -1.6,0 Q 0,0 0,-1.6 Z" fill="#FFFFFF" />
            <circle cx="0" cy="0" r="0.35" fill="#A855F7" />
          </g>
        `;
      }).join('\n')}
    `
  },
  {
    id: 7,
    key: 'synthwave_grid',
    title: 'RETRO ARCADE SYNTHWAVE',
    thaiTitle: 'แบบที่ 7: เรโทรซินธ์เวฟ 80s (Retro Synthwave Arcade)',
    color: '#FF007F',
    renderSvg: () => `
      <defs>
        <filter id="glow7" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.55" flood-color="#FF007F" flood-opacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="0.2" flood-color="#00F5FF" flood-opacity="0.8" />
        </filter>
      </defs>
      <!-- Dual Segmented Synthwave Bones -->
      <g stroke="#FF007F" stroke-width="0.9" stroke-linecap="round" filter="url(#glow7)">
        ${renderLines('#FF007F', 0.9)}
      </g>
      <g stroke="#00F5FF" stroke-width="0.32" stroke-dasharray="1.5 1">
        ${renderLines('#00F5FF', 0.32)}
      </g>
      <!-- Diamond Retro Nodes -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <g transform="translate(${x}, ${y})">
            <polygon points="0,-1.0 1.0,0 0,1.0 -1.0,0" fill="${isTip ? '#00F5FF' : '#FF007F'}" stroke="#FFFFFF" stroke-width="0.2" filter="url(#glow7)" />
          </g>
        `;
      }).join('\n')}
    `
  },
  {
    id: 8,
    key: 'quantum_circuit',
    title: 'QUANTUM CIRCUIT MATRIX',
    thaiTitle: 'แบบที่ 8: แผ่นปรินต์วงจรอิเล็กทรอนิกส์ (PCB Gold Bus Traces)',
    color: '#FBBF24',
    renderSvg: () => `
      <defs>
        <filter id="glow8" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.4" flood-color="#FBBF24" flood-opacity="0.85" />
        </filter>
      </defs>
      <!-- PCB Copper Bus Traces -->
      <g stroke="#FBBF24" stroke-width="0.8" stroke-linecap="square" filter="url(#glow8)">
        ${renderLines('#FBBF24', 0.8)}
      </g>
      <!-- SMD Solder Pads on Joints -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        const labels = ['GND', 'VCC', 'TX', 'RX', 'GPIO4', 'GPIO5', 'PWM', 'SCL', 'SDA', 'BGA', 'INT', 'MOSI', 'MISO', 'SCK', 'CS', 'ADC1', 'ADC2', 'D+', 'D-', 'RST', 'BOOT'];
        return `
          <g transform="translate(${x}, ${y})">
            <rect x="-0.85" y="-0.85" width="1.7" height="1.7" fill="#FBBF24" stroke="#FFFFFF" stroke-width="0.2" filter="url(#glow8)" />
            <circle cx="0" cy="0" r="0.25" fill="#000000" />
            ${isTip ? `<text x="1.8" y="0.5" fill="#FBBF24" font-size="1.1" font-family="monospace" font-weight="bold">${labels[Number(i)]}</text>` : ''}
          </g>
        `;
      }).join('\n')}
    `
  },
  {
    id: 9,
    key: 'sonar_radar',
    title: 'TACTICAL SONAR PHOSPHOR',
    thaiTitle: 'แบบที่ 9: เรดาร์โซนาร์ฟอสฟอรัส (Phosphor Radar Scope)',
    color: '#22C55E',
    renderSvg: () => `
      <defs>
        <filter id="glow9" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.5" flood-color="#22C55E" flood-opacity="0.85" />
        </filter>
      </defs>
      <!-- Phosphor Green Tracks -->
      <g stroke="#22C55E" stroke-width="0.9" stroke-linecap="round" filter="url(#glow9)">
        ${renderLines('#22C55E', 0.9)}
      </g>
      <!-- Blip Range Rings -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <g transform="translate(${x}, ${y})">
            <circle cx="0" cy="0" r="${isTip ? 1.05 : 0.65}" fill="#86EFAC" stroke="#22C55E" stroke-width="0.2" filter="url(#glow9)" />
            ${isTip ? `<circle cx="0" cy="0" r="1.7" fill="none" stroke="#22C55E" stroke-width="0.2" stroke-dasharray="0.6 0.6" />` : ''}
          </g>
        `;
      }).join('\n')}
    `
  },
  {
    id: 10,
    key: 'glassmorphism_frost',
    title: 'FROSTED GLASSMORPHISM CAPSULE',
    thaiTitle: 'แบบที่ 10: แคปซูลแก้วฝ้าพรีเมียม (Apple VisionOS Glass)',
    color: '#E2E8F0',
    renderSvg: () => `
      <defs>
        <filter id="glow10" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.6" flood-color="#000000" flood-opacity="0.5" />
        </filter>
        <linearGradient id="pillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.9)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.3)" />
        </linearGradient>
      </defs>
      <!-- Translucent Frosted Glass Capsules -->
      <g stroke="url(#pillGrad)" stroke-width="1.3" stroke-linecap="round" filter="url(#glow10)" opacity="0.92">
        ${renderLines('url(#pillGrad)', 1.3)}
      </g>
      <!-- Glass Pearl Beads -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <g transform="translate(${x}, ${y})" filter="url(#glow10)">
            <circle cx="0" cy="0" r="${isTip ? 1.15 : 0.8}" fill="#FFFFFF" stroke="rgba(255,255,255,0.85)" stroke-width="0.25" />
            <circle cx="-0.2" cy="-0.2" r="0.28" fill="#FFFFFF" opacity="0.85" />
          </g>
        `;
      }).join('\n')}
    `
  }
];

async function generateAllNewPreviews() {
  console.log('Generating 10 new pure tracking preview PNGs on uploaded image...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  for (const style of STYLES) {
    console.log(`[Style ${style.id}/10] Rendering: ${style.title}...`);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #000; width: 1024px; height: 576px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; overflow: hidden; }
    .stage { position: relative; width: 1024px; height: 576px; background: #000; overflow: hidden; }
    .camera-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .svg-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; }
    
    /* Sleek Top Telemetry Badge */
    .top-badge { position: absolute; top: 16px; left: 16px; background: rgba(5,8,14,0.88); border: 1px solid ${style.color}; padding: 6px 14px; border-radius: 20px; display: flex; align-items: center; gap: 10px; z-index: 20; backdrop-filter: blur(12px); box-shadow: 0 4px 16px rgba(0,0,0,0.6); }
    .num-pill { background: ${style.color}; color: #000; font-weight: 900; font-size: 10px; font-family: monospace; padding: 2px 7px; border-radius: 10px; }
    .title-text { color: #FFF; font-weight: 700; font-size: 11px; letter-spacing: 1px; font-family: monospace; }

    /* Bottom Info Badge */
    .bottom-badge { position: absolute; bottom: 16px; left: 16px; background: rgba(5,8,14,0.85); border: 1px solid rgba(255,255,255,0.15); padding: 5px 12px; border-radius: 16px; display: flex; align-items: center; gap: 8px; z-index: 20; backdrop-filter: blur(8px); }
    .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: ${style.color}; }
    .info-text { color: #94A3B8; font-size: 10px; font-family: monospace; }
  </style>
</head>
<body>
  <div class='stage'>
    <img src='${dataUri}' class='camera-img' />
    
    <div class='top-badge'>
      <span class='num-pill'>STYLE 0${style.id}</span>
      <span class='title-text'>${style.title}</span>
    </div>

    <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="svg-layer">
      ${style.renderSvg()}
    </svg>

    <div class='bottom-badge'>
      <span class='pulse-dot'></span>
      <span class='info-text'>21 MEDIAPIPE LANDMARKS · HAND TRACKING ACTIVE</span>
    </div>
  </div>
</body>
</html>`;

    const tempHtml = `C:/Users/satit/AppData/Local/Temp/preview_pure_${style.id}.html`;
    const tempPng = `C:/Users/satit/AppData/Local/Temp/preview_pure_${style.id}.png`;
    fs.writeFileSync(tempHtml, html);

    const cmd = `"${edgePath}" --headless=new --disable-gpu --user-data-dir="C:\\Users\\satit\\AppData\\Local\\Temp\\edgetemp" --window-size=1024,576 --screenshot="${tempPng}" "file:///${tempHtml}"`;
    execSync(cmd, { stdio: 'pipe' });

    // Copy to brain artifact directory with descriptive and numbered names
    const destName = `preview_style_${String(style.id).padStart(2, '0')}_${style.key}.png`;
    const destNumbered = `preview_style_${style.id}.png`;
    const brainDest = path.join(brainDir, destName);
    const brainNumberedDest = path.join(brainDir, destNumbered);

    fs.copyFileSync(tempPng, brainDest);
    fs.copyFileSync(tempPng, brainNumberedDest);
    console.log(` -> Saved: ${destName} (${fs.statSync(brainDest).size} bytes)`);
  }

  console.log('\nAll 10 pure tracking previews generated successfully!');
}

generateAllNewPreviews().catch(err => {
  console.error('Error generating previews:', err);
  process.exit(1);
});
