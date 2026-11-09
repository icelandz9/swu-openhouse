import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const brainDir = 'C:/Users/satit/.gemini/antigravity/brain/e8cf40fb-311f-4066-aa48-0e4da4416106';
const imgPath = path.join(brainDir, '.user_uploaded/media_1794231568745_d530aac8.jpg');
const b64 = fs.readFileSync(imgPath).toString('base64');
const dataUri = `data:image/jpeg;base64,${b64}`;

const logoPath = 'c:/Users/satit/OneDrive/Desktop/PhotoBooth-OpenHouseSWU/web/public/logo/cpe-logo.png';
const logoB64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
const logoUri = logoB64 ? `data:image/png;base64,${logoB64}` : '';

// 21 Landmark points mapped precisely to the hand in media_1794231568745_d530aac8.jpg (percentage 0-100)
const P = {
  0: [77.0, 98.0], // Wrist
  1: [48.0, 91.5], // Thumb CMC
  2: [27.5, 77.0], // Thumb MCP
  3: [15.5, 60.5], // Thumb IP
  4: [6.5, 48.0],  // Thumb Tip
  5: [46.0, 50.5], // Index MCP
  6: [33.5, 33.0], // Index PIP
  7: [27.5, 21.5], // Index DIP
  8: [24.5, 11.0], // Index Tip
  9: [59.0, 48.0], // Middle MCP (Palm Center)
  10: [52.5, 27.5], // Middle PIP
  11: [48.5, 14.0], // Middle DIP
  12: [46.0, 2.5],  // Middle Tip
  13: [74.0, 50.5], // Ring MCP
  14: [69.5, 30.5], // Ring PIP
  15: [64.5, 18.5], // Ring DIP
  16: [61.0, 8.5],  // Ring Tip
  17: [86.5, 54.0], // Pinky MCP
  18: [91.0, 40.5], // Pinky PIP
  19: [90.0, 32.5], // Pinky DIP
  20: [85.5, 23.5], // Pinky Tip
};

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [9, 13], [13, 14], [14, 15], [15, 16],// Ring
  [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [0, 17],                              // Palm Base
];

// Helper to render basic lines
function renderLines(stroke, width, extra = '') {
  return BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" ${extra} />`).join('\n');
}

// 10 Style Definitions
const STYLES = [
  {
    id: 1,
    key: 'cpe_crimson',
    title: 'CPE TACTICAL CRIMSON HUD',
    thaiTitle: 'แบบที่ 1: แทคติคอลแดงวิศวะ CPE (Official SWU Theme)',
    description: 'เส้นโครงคู่สีแดงเข้ม CPE (#CE1126) ผสมผสานเป้าเล็ง Crosshair ทหาร, เกจพลังงาน 4 เซกเตอร์ และพิกัด Telemetry ทางยุทธวิธี สื่อถึงอัตลักษณ์วิศวกรรมคอมพิวเตอร์อย่างสง่างามและหนักแน่น',
    badgeColor: '#CE1126',
    hudBorder: '#CE1126',
    renderSvg: () => `
      <defs>
        <filter id="crimsonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.6" flood-color="#CE1126" flood-opacity="0.9" />
        </filter>
        <linearGradient id="crimsonLaser" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#CE1126" stop-opacity="0" />
          <stop offset="30%" stop-color="#CE1126" stop-opacity="0.9" />
          <stop offset="50%" stop-color="#FFFFFF" stop-opacity="1" />
          <stop offset="70%" stop-color="#CE1126" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#CE1126" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Tactical Bounding Box -->
      <g stroke="#CE1126" stroke-width="0.5" fill="none" opacity="0.85">
        <!-- Top Left -->
        <path d="M 4 25 L 4 10 L 20 10" />
        <rect x="3" y="9" width="3" height="3" fill="#CE1126" />
        <text x="8" y="8" fill="#CE1126" font-size="2.2" font-family="monospace" letter-spacing="0.2">LOC: [59.0, 48.0] TARGET_ACQUIRED</text>
        <!-- Top Right -->
        <path d="M 94 25 L 94 10 L 78 10" />
        <rect x="92" y="9" width="3" height="3" fill="#CE1126" />
        <text x="75" y="8" fill="#CE1126" font-size="2.2" font-family="monospace">MODE: MIL-SPEC</text>
        <!-- Bottom Left -->
        <path d="M 4 85 L 4 98 L 20 98" />
        <!-- Bottom Right -->
        <path d="M 94 85 L 94 98 L 78 98" />
      </g>

      <!-- Laser Scanline -->
      <line x1="4" y1="52" x2="94" y2="52" stroke="url(#crimsonLaser)" stroke-width="1.2" filter="url(#crimsonGlow)" />
      <circle cx="4" cy="52" r="1.2" fill="#CE1126" filter="url(#crimsonGlow)" />
      <circle cx="94" cy="52" r="1.2" fill="#CE1126" filter="url(#crimsonGlow)" />

      <!-- Dual Rail Bones -->
      <g stroke="#CE1126" stroke-width="1.2" stroke-linecap="round" filter="url(#crimsonGlow)">
        ${renderLines('#CE1126', 1.2)}
      </g>
      <g stroke="#FFFFFF" stroke-width="0.35" stroke-linecap="round">
        ${renderLines('#FFFFFF', 0.35)}
      </g>

      <!-- Tactical Crosshair Joints -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        const isWrist = Number(i) === 0;
        if (isWrist) {
          return `
            <g transform="translate(${x}, ${y})">
              <polygon points="0,-2.5 2.5,0 0,2.5 -2.5,0" fill="#CE1126" stroke="#FFFFFF" stroke-width="0.4" filter="url(#crimsonGlow)" />
              <circle cx="0" cy="0" r="1" fill="#FFFFFF" />
            </g>
          `;
        }
        return `
          <g transform="translate(${x}, ${y})">
            <!-- Crosshair lines -->
            <line x1="-1.6" y1="0" x2="1.6" y2="0" stroke="#FFFFFF" stroke-width="0.35" />
            <line x1="0" y1="-1.6" x2="0" y2="1.6" stroke="#FFFFFF" stroke-width="0.35" />
            <!-- Node circle -->
            <circle cx="0" cy="0" r="${isTip ? 1.4 : 0.8}" fill="${isTip ? '#FFFFFF' : '#CE1126'}" stroke="#CE1126" stroke-width="0.3" filter="url(#crimsonGlow)" />
          </g>
        `;
      }).join('\n')}

      <!-- Palm Center: Tactical Azimuth Dial -->
      <g transform="translate(${P[9][0]}, ${P[9][1]})">
        <!-- Outer degree marks -->
        <circle cx="0" cy="0" r="6.5" fill="none" stroke="#CE1126" stroke-width="0.4" stroke-dasharray="1.2 1.2" />
        <circle cx="0" cy="0" r="5.2" fill="none" stroke="#CE1126" stroke-width="0.3" opacity="0.6" />
        <!-- 4 quadrant brackets -->
        <path d="M -5.2 0 A 5.2 5.2 0 0 1 0 -5.2" fill="none" stroke="#FFFFFF" stroke-width="0.7" />
        <path d="M 0 5.2 A 5.2 5.2 0 0 1 5.2 0" fill="none" stroke="#FFFFFF" stroke-width="0.7" />
        <!-- Progress Arc 78% -->
        <circle cx="0" cy="0" r="5.2" fill="none" stroke="#CE1126" stroke-width="1.2" stroke-dasharray="32.6" stroke-dashoffset="7.2" stroke-linecap="round" filter="url(#crimsonGlow)" />
        <circle cx="0" cy="0" r="2.2" fill="rgba(206,17,38,0.25)" stroke="#CE1126" stroke-width="0.5" />
        <text x="0" y="0.8" fill="#FFFFFF" font-size="2" font-weight="bold" font-family="monospace" text-anchor="middle">78%</text>
        <text x="0" y="8.5" fill="#CE1126" font-size="1.8" font-weight="bold" font-family="monospace" text-anchor="middle" letter-spacing="0.2">CPE-LOCK</text>
      </g>
    `
  },
  {
    id: 2,
    key: 'cyber_neon',
    title: 'CYBERPUNK NEON AQUA',
    thaiTitle: 'แบบที่ 2: นีออนไซไฟไฮเทค (Cyberpunk Cyan Pulse)',
    description: 'เส้นเลเซอร์นีออนสีฟ้าสด (#00F5FF / #06B6D4) เรืองแสงสว่างจ้า ปลายนิ้วมีวงแหวนพัลส์หมุนวน และวงแหวนไจโรกลางฝ่ามือแบบโฮโลแกรม ให้ความรู้สึกล้ำยุค ตื่นตาตื่นใจ เหมาะกับเด็กมัธยมในงานเทศกาล',
    badgeColor: '#00F5FF',
    hudBorder: '#00F5FF',
    renderSvg: () => `
      <defs>
        <filter id="neonAquaGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.2" flood-color="#00F5FF" flood-opacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="0.4" flood-color="#FFFFFF" flood-opacity="1" />
        </filter>
        <linearGradient id="neonLaser" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00F5FF" stop-opacity="0" />
          <stop offset="25%" stop-color="#00F5FF" stop-opacity="0.8" />
          <stop offset="50%" stop-color="#FFFFFF" stop-opacity="1" />
          <stop offset="75%" stop-color="#00F5FF" stop-opacity="0.8" />
          <stop offset="100%" stop-color="#00F5FF" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Cyber Corner Brackets with 45-degree cuts -->
      <g stroke="#00F5FF" stroke-width="0.7" fill="none" opacity="0.9" filter="url(#neonAquaGlow)">
        <path d="M 4 20 L 4 12 L 12 4 L 22 4" />
        <circle cx="12" cy="4" r="0.8" fill="#00F5FF" />
        <text x="24" y="6" fill="#00F5FF" font-size="2" font-family="monospace">0x7F_CYBER_TRACK</text>
        <path d="M 94 20 L 94 12 L 86 4 L 76 4" />
        <circle cx="86" cy="4" r="0.8" fill="#00F5FF" />
        <path d="M 4 80 L 4 88 L 12 96 L 22 96" />
        <path d="M 94 80 L 94 88 L 86 96 L 76 96" />
      </g>

      <!-- Laser Beam -->
      <line x1="4" y1="52" x2="94" y2="52" stroke="url(#neonLaser)" stroke-width="1.4" filter="url(#neonAquaGlow)" />

      <!-- Glowing Neon Bones -->
      <g stroke="#00F5FF" stroke-width="1.3" stroke-linecap="round" filter="url(#neonAquaGlow)">
        ${renderLines('#00F5FF', 1.3)}
      </g>
      <g stroke="#FFFFFF" stroke-width="0.4" stroke-linecap="round">
        ${renderLines('#FFFFFF', 0.4)}
      </g>

      <!-- Glowing Nodes -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <g transform="translate(${x}, ${y})">
            ${isTip ? `
              <circle cx="0" cy="0" r="2.8" fill="none" stroke="#00F5FF" stroke-width="0.35" stroke-dasharray="1 1" filter="url(#neonAquaGlow)" />
              <circle cx="0" cy="0" r="1.6" fill="#FFFFFF" stroke="#00F5FF" stroke-width="0.5" filter="url(#neonAquaGlow)" />
            ` : `
              <circle cx="0" cy="0" r="1.1" fill="#00F5FF" stroke="#FFFFFF" stroke-width="0.4" filter="url(#neonAquaGlow)" />
            `}
          </g>
        `;
      }).join('\n')}

      <!-- Holographic Dual Gyro Ring at Palm Center -->
      <g transform="translate(${P[9][0]}, ${P[9][1]})">
        <circle cx="0" cy="0" r="6.8" fill="none" stroke="#00F5FF" stroke-width="0.5" stroke-dasharray="2 1.5" opacity="0.7" />
        <circle cx="0" cy="0" r="5.4" fill="rgba(0,245,255,0.15)" stroke="#00F5FF" stroke-width="1.4" stroke-dasharray="33.9" stroke-dashoffset="7.4" stroke-linecap="round" filter="url(#neonAquaGlow)" />
        <circle cx="0" cy="0" r="3.2" fill="none" stroke="#FFFFFF" stroke-width="0.4" stroke-dasharray="1 1" />
        <text x="0" y="1" fill="#FFFFFF" font-size="2.4" font-weight="black" font-family="monospace" text-anchor="middle" filter="url(#neonAquaGlow)">78%</text>
      </g>
    `
  },
  {
    id: 3,
    key: 'minimalist_wireframe',
    title: 'MINIMALIST BAUHAUS & DOTS',
    thaiTitle: 'แบบที่ 3: มินิมอลเรียบหรู (Apple / Braun Clean Aesthetic)',
    description: 'เส้นโครงร่างสีขาวบางเฉียบ 0.8px ไร้แสงฟุ้งรบกวนตา จุด Landmark เป็นวงกลมมินิมอลคมชัด และวงแหวนเปอร์เซ็นต์แบบ Hairline Typography สบายตา ไม่บดบังใบหน้าหรือท่าโพสของผู้ถ่าย',
    badgeColor: '#FFFFFF',
    hudBorder: '#64748B',
    renderSvg: () => `
      <!-- Subtle Corner Ticks -->
      <g stroke="rgba(255,255,255,0.5)" stroke-width="0.4" fill="none">
        <path d="M 6 16 L 6 10 L 12 10" />
        <path d="M 92 16 L 92 10 L 86 10" />
        <path d="M 6 84 L 6 90 L 12 90" />
        <path d="M 92 84 L 92 90 L 86 90" />
      </g>

      <!-- Clean Hairline Scanbar -->
      <line x1="6" y1="52" x2="92" y2="52" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" stroke-dasharray="2 2" />

      <!-- Minimalist Hairline Bones -->
      <g stroke="rgba(255,255,255,0.7)" stroke-width="0.7" stroke-linecap="round">
        ${renderLines('rgba(255,255,255,0.7)', 0.7)}
      </g>

      <!-- Solid Crisp Dots -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <circle cx="${x}" cy="${y}" r="${isTip ? 1.3 : 0.8}" fill="#FFFFFF" stroke="#000000" stroke-width="0.25" />
        `;
      }).join('\n')}

      <!-- Palm Center: Clean Progress Arc -->
      <g transform="translate(${P[9][0]}, ${P[9][1]})">
        <circle cx="0" cy="0" r="5" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.6" />
        <circle cx="0" cy="0" r="5" fill="none" stroke="#FFFFFF" stroke-width="0.9" stroke-dasharray="31.4" stroke-dashoffset="6.9" stroke-linecap="round" />
        <text x="0" y="0.8" fill="#FFFFFF" font-size="2.1" font-weight="600" font-family="sans-serif" text-anchor="middle">78%</text>
        <text x="0" y="7.5" fill="rgba(255,255,255,0.6)" font-size="1.4" font-family="sans-serif" text-anchor="middle" letter-spacing="0.1">HOLDING</text>
      </g>
    `
  },
  {
    id: 4,
    key: 'arc_reactor',
    title: 'IRON MAN ARC REACTOR HOLOGRAM',
    thaiTitle: 'แบบที่ 4: เตาปฏิกรณ์มาร์เวล (Iron Man Arc Reactor)',
    description: 'กลางฝ่ามือเปล่งประกายด้วยเตาปฏิกรณ์ Arc Reactor หลายชั้นซ้อนกัน ลำแสงพลังงานสีทองอร่าม (#F59E0B) ตัดกับพลาสมาสีฟ้าคราม (#22D3EE) ปลายนิ้วมีวงแหวน Repulsor หมุนควง เหมือนกำลังชาร์จพลังยิงถ่ายรูป',
    badgeColor: '#F59E0B',
    hudBorder: '#F59E0B',
    renderSvg: () => `
      <defs>
        <filter id="arcGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.8" flood-color="#22D3EE" flood-opacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="0.4" flood-color="#F59E0B" flood-opacity="0.8" />
        </filter>
      </defs>

      <!-- Holographic Range Target Brackets -->
      <g stroke="#F59E0B" stroke-width="0.5" fill="none" opacity="0.85">
        <circle cx="50" cy="50" r="44" stroke="#22D3EE" stroke-width="0.3" stroke-dasharray="3 3" opacity="0.4" />
        <path d="M 6 18 A 44 44 0 0 1 18 6" stroke="#F59E0B" stroke-width="0.8" />
        <path d="M 94 18 A 44 44 0 0 0 82 6" stroke="#F59E0B" stroke-width="0.8" />
        <text x="10" y="6" fill="#F59E0B" font-size="2" font-family="monospace">PWR: 94.2 GW [CHARGING]</text>
      </g>

      <!-- Energy Plasma Conduits -->
      <g stroke="#F59E0B" stroke-width="1.2" stroke-linecap="round" filter="url(#arcGlow)">
        ${renderLines('#F59E0B', 1.2)}
      </g>
      <g stroke="#22D3EE" stroke-width="0.4" stroke-linecap="round">
        ${renderLines('#22D3EE', 0.4)}
      </g>

      <!-- Repulsor Tip Coils -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <g transform="translate(${x}, ${y})">
            ${isTip ? `
              <circle cx="0" cy="0" r="2.2" fill="none" stroke="#22D3EE" stroke-width="0.4" stroke-dasharray="1.2 0.8" />
              <circle cx="0" cy="0" r="1.5" fill="#F59E0B" stroke="#FFFFFF" stroke-width="0.4" filter="url(#arcGlow)" />
              <circle cx="0" cy="0" r="0.6" fill="#FFFFFF" />
            ` : `
              <circle cx="0" cy="0" r="1" fill="#22D3EE" stroke="#FFFFFF" stroke-width="0.3" filter="url(#arcGlow)" />
            `}
          </g>
        `;
      }).join('\n')}

      <!-- Arc Reactor Core at Palm Center -->
      <g transform="translate(${P[9][0]}, ${P[9][1]})" filter="url(#arcGlow)">
        <circle cx="0" cy="0" r="7.2" fill="none" stroke="#F59E0B" stroke-width="0.4" stroke-dasharray="1.5 1.5" />
        <!-- 10 Magnetic Coil Segments -->
        ${[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map(deg => `
          <line x1="0" y1="-5.8" x2="0" y2="-4.4" stroke="#F59E0B" stroke-width="1" transform="rotate(${deg})" />
        `).join('')}
        <circle cx="0" cy="0" r="5.2" fill="rgba(34,211,238,0.2)" stroke="#22D3EE" stroke-width="1.2" stroke-dasharray="32.6" stroke-dashoffset="7.2" stroke-linecap="round" />
        <circle cx="0" cy="0" r="2.8" fill="#FFFFFF" stroke="#22D3EE" stroke-width="0.6" />
        <text x="0" y="0.8" fill="#F59E0B" font-size="2" font-weight="black" font-family="monospace" text-anchor="middle">78%</text>
        <text x="0" y="9.5" fill="#22D3EE" font-size="1.8" font-family="monospace" text-anchor="middle">REPULSOR</text>
      </g>
    `
  },
  {
    id: 5,
    key: 'biometric_heatmap',
    title: 'BIOMETRIC SCANNER & HEATMAP',
    thaiTitle: 'แบบที่ 5: สแกนเนอร์ชีวมิติฮีทแมพ (Biometric Thermal Spectrum)',
    description: 'เส้นกระดูกไล่เฉดสีตามสเปกตรัมความร้อน (ม่วง -> ฟ้า -> เขียว -> ส้ม -> แดง) แสดงถึงแรงกดและระยะลึกของมือ กลางฝ่ามือมีกราฟิกสแกนลายนิ้วมือ และค่า Telemetry ร่างกายสุดล้ำ',
    badgeColor: '#10B981',
    hudBorder: '#10B981',
    renderSvg: () => `
      <defs>
        <linearGradient id="thermalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38BDF8" />
          <stop offset="30%" stop-color="#10B981" />
          <stop offset="60%" stop-color="#FBBF24" />
          <stop offset="100%" stop-color="#EF4444" />
        </linearGradient>
      </defs>

      <!-- Medical Caliper Brackets -->
      <g stroke="#10B981" stroke-width="0.5" fill="none">
        <path d="M 4 22 L 4 8 L 18 8" />
        <line x1="4" y1="12" x2="7" y2="12" />
        <line x1="4" y1="16" x2="6" y2="16" />
        <text x="8" y="6" fill="#10B981" font-size="2" font-family="monospace">CALIPER X: 42.1mm | TEMP: 36.5°C</text>
        <path d="M 94 22 L 94 8 L 80 8" />
        <path d="M 4 80 L 4 96 L 18 96" />
        <path d="M 94 80 L 94 96 L 80 96" />
      </g>

      <!-- Thermal Gradient Bones -->
      <g stroke="url(#thermalGrad)" stroke-width="1.3" stroke-linecap="round">
        ${renderLines('url(#thermalGrad)', 1.3)}
      </g>

      <!-- Joint Badges with Coordinates -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        const color = y < 30 ? '#38BDF8' : y < 55 ? '#10B981' : y < 80 ? '#FBBF24' : '#EF4444';
        return `
          <g transform="translate(${x}, ${y})">
            <circle cx="0" cy="0" r="${isTip ? 1.4 : 0.9}" fill="${color}" stroke="#FFFFFF" stroke-width="0.3" />
          </g>
        `;
      }).join('\n')}

      <!-- Palm Center: Fingerprint Biometric Grid -->
      <g transform="translate(${P[9][0]}, ${P[9][1]})">
        <!-- Fingerprint stylized arches -->
        <path d="M -3 -1 A 3 3 0 0 1 3 -1" stroke="#10B981" stroke-width="0.4" fill="none" opacity="0.6" />
        <path d="M -4 1 A 4 4 0 0 1 4 1" stroke="#10B981" stroke-width="0.4" fill="none" opacity="0.7" />
        <path d="M -2.2 -3 A 2.2 2.2 0 0 1 2.2 -3" stroke="#10B981" stroke-width="0.4" fill="none" opacity="0.5" />
        <!-- Radial Progress Bar -->
        <circle cx="0" cy="0" r="5.6" fill="none" stroke="#10B981" stroke-width="1.2" stroke-dasharray="35.1" stroke-dashoffset="7.7" stroke-linecap="round" />
        <text x="0" y="0.8" fill="#FFFFFF" font-size="2" font-weight="bold" font-family="monospace" text-anchor="middle">78%</text>
        <text x="0" y="8" fill="#10B981" font-size="1.7" font-family="monospace" text-anchor="middle">MATCH 99.8%</text>
      </g>
    `
  },
  {
    id: 6,
    key: 'constellation_stars',
    title: 'CONSTELLATION STAR MAP',
    thaiTitle: 'แบบที่ 6: กลุ่มดาวจักรวาลวิศวกรรม (Celestial Constellations)',
    description: 'ข้อต่อแต่ละจุดส่องแสงเป็นดาวฤกษ์ 4 แฉกระยิบระยับ เชื่อมโยงด้วยเส้นใยกลุ่มดาวสีม่วงคอสมิกและฟ้าดาราศาสตร์ (#8B5CF6 / #38BDF8) กลางฝ่ามือเป็นเข็มทิศดวงดาว สวยงามและมีเสน่ห์ดึงดูดใจ',
    badgeColor: '#8B5CF6',
    hudBorder: '#8B5CF6',
    renderSvg: () => `
      <defs>
        <filter id="starGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.7" flood-color="#8B5CF6" flood-opacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="0.3" flood-color="#FFFFFF" flood-opacity="1" />
        </filter>
      </defs>

      <!-- Celestial Boundary Frame -->
      <g stroke="#8B5CF6" stroke-width="0.4" fill="none" opacity="0.7">
        <circle cx="8" cy="8" r="1.5" fill="#8B5CF6" />
        <circle cx="92" cy="8" r="1.5" fill="#8B5CF6" />
        <circle cx="8" cy="94" r="1.5" fill="#8B5CF6" />
        <circle cx="92" cy="94" r="1.5" fill="#8B5CF6" />
        <line x1="8" y1="8" x2="22" y2="8" />
        <line x1="8" y1="8" x2="8" y2="22" />
        <text x="14" y="6" fill="#A855F7" font-size="2" font-family="serif">ORION CLUSTER · SWU CPE</text>
      </g>

      <!-- Constellation Filaments -->
      <g stroke="#C084FC" stroke-width="0.8" stroke-linecap="round" stroke-dasharray="3 0.8" filter="url(#starGlow)">
        ${renderLines('#C084FC', 0.8)}
      </g>

      <!-- 4-Pointed Sparkle Stars on Joints -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        const scale = isTip ? 1.6 : 1;
        return `
          <g transform="translate(${x}, ${y}) scale(${scale})" filter="url(#starGlow)">
            <!-- 4-pointed star shape -->
            <path d="M 0,-2.2 Q 0,0 2.2,0 Q 0,0 0,2.2 Q 0,0 -2.2,0 Q 0,0 0,-2.2 Z" fill="#FFFFFF" />
            <circle cx="0" cy="0" r="0.5" fill="#8B5CF6" />
          </g>
        `;
      }).join('\n')}

      <!-- Palm Center: Astrolabe Celestial Dial -->
      <g transform="translate(${P[9][0]}, ${P[9][1]})" filter="url(#starGlow)">
        <circle cx="0" cy="0" r="6" fill="rgba(139,92,246,0.15)" stroke="#8B5CF6" stroke-width="0.4" stroke-dasharray="0.8 0.8" />
        <circle cx="0" cy="0" r="5" fill="none" stroke="#C084FC" stroke-width="1.2" stroke-dasharray="31.4" stroke-dashoffset="6.9" stroke-linecap="round" />
        <!-- 8-point compass star in center -->
        <path d="M 0,-1.8 L 0.5,-0.5 L 1.8,0 L 0.5,0.5 L 0,1.8 L -0.5,0.5 L -1.8,0 L -0.5,-0.5 Z" fill="#FFFFFF" />
        <text x="0" y="8" fill="#C084FC" font-size="1.8" font-family="serif" text-anchor="middle">STELLAR 78%</text>
      </g>
    `
  },
  {
    id: 7,
    key: 'synthwave_grid',
    title: 'RETRO ARCADE SYNTHWAVE',
    thaiTitle: 'แบบที่ 7: เรโทรซินธ์เวฟ 80s (Retro Synthwave Arcade)',
    description: 'สไตล์นีออนย้อนยุคยุค 80s ด้วยคู่สีชมพูมาเจนต้า (#FF007F) ตัดม่วงและฟ้าคราม กลางฝ่ามือเป็นพระอาทิตย์เส้นแนวนอนสไตล์เอาท์รัน และกรอบ 3D Perspective Grid สนุกสนาน โดนใจสายป๊อปคัลเจอร์',
    badgeColor: '#FF007F',
    hudBorder: '#FF007F',
    renderSvg: () => `
      <defs>
        <filter id="synthGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.8" flood-color="#FF007F" flood-opacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="0.4" flood-color="#00F5FF" flood-opacity="0.8" />
        </filter>
      </defs>

      <!-- 80s Arcade Perspective Grid Frame -->
      <g stroke="#FF007F" stroke-width="0.5" fill="none">
        <rect x="5" y="8" width="90" height="88" stroke="#A855F7" stroke-width="0.4" opacity="0.4" />
        <path d="M 5 22 L 5 8 L 20 8" stroke="#FF007F" stroke-width="0.9" />
        <path d="M 95 22 L 95 8 L 80 8" stroke="#00F5FF" stroke-width="0.9" />
        <text x="8" y="6" fill="#FF007F" font-size="2.2" font-family="monospace" font-weight="bold">STAGE 1: READY PLAYER ONE</text>
        <text x="76" y="6" fill="#00F5FF" font-size="2.2" font-family="monospace">SCORE: 1986</text>
      </g>

      <!-- Segmented Synthwave Bones -->
      <g stroke="#FF007F" stroke-width="1.3" stroke-linecap="round" filter="url(#synthGlow)">
        ${renderLines('#FF007F', 1.3)}
      </g>
      <g stroke="#00F5FF" stroke-width="0.5" stroke-dasharray="2 1.5">
        ${renderLines('#00F5FF', 0.5)}
      </g>

      <!-- Diamond Retro Nodes -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <g transform="translate(${x}, ${y})">
            <polygon points="0,-1.4 1.4,0 0,1.4 -1.4,0" fill="${isTip ? '#00F5FF' : '#FF007F'}" stroke="#FFFFFF" stroke-width="0.3" filter="url(#synthGlow)" />
          </g>
        `;
      }).join('\n')}

      <!-- Palm Center: Iconic Sliced Synthwave Sun -->
      <g transform="translate(${P[9][0]}, ${P[9][1]})" filter="url(#synthGlow)">
        <!-- Sliced Sun disk -->
        <circle cx="0" cy="0" r="4.8" fill="rgba(255,0,127,0.2)" stroke="#FF007F" stroke-width="0.6" />
        <line x1="-4" y1="-1" x2="4" y2="-1" stroke="#000000" stroke-width="0.4" />
        <line x1="-4.4" y1="0.5" x2="4.4" y2="0.5" stroke="#000000" stroke-width="0.6" />
        <line x1="-3.6" y1="2" x2="3.6" y2="2" stroke="#000000" stroke-width="0.8" />
        <!-- Progress Arc -->
        <circle cx="0" cy="0" r="6" fill="none" stroke="#00F5FF" stroke-width="1.2" stroke-dasharray="37.7" stroke-dashoffset="8.3" stroke-linecap="round" />
        <text x="0" y="0.8" fill="#FFFFFF" font-size="2" font-weight="black" font-family="monospace" text-anchor="middle">78%</text>
        <text x="0" y="8.5" fill="#FF007F" font-size="1.8" font-weight="bold" font-family="monospace" text-anchor="middle">SYNTH-WAVE</text>
      </g>
    `
  },
  {
    id: 8,
    key: 'quantum_circuit',
    title: 'QUANTUM CIRCUIT MATRIX',
    thaiTitle: 'แบบที่ 8: แผ่นปรินต์วงจรอิเล็กทรอนิกส์ (PCB Gold Bus)',
    description: 'สายแลนและลายวงจรพิมพ์สีทองอร่าม (#FBBF24) วิ่งหักมุม 45° และ 90° ตามมาตรฐานวิศวกรรมฮาร์ดแวร์ ข้อต่อเป็นจุดบัดกรี SMD และชิป IC ซ็อกเก็ตกลางฝ่ามือ สะท้อนตัวตนความเป็นวิศวะคอมพิวเตอร์อย่างแท้จริง',
    badgeColor: '#FBBF24',
    hudBorder: '#FBBF24',
    renderSvg: () => `
      <defs>
        <filter id="pcbGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.6" flood-color="#FBBF24" flood-opacity="0.8" />
        </filter>
      </defs>

      <!-- PCB Board Grid & Fiducial Marks -->
      <g stroke="#FBBF24" stroke-width="0.4" fill="none" opacity="0.7">
        <!-- Corner Fiducial Marks -->
        <circle cx="6" cy="10" r="1.5" stroke="#FBBF24" />
        <circle cx="6" cy="10" r="0.5" fill="#FBBF24" />
        <circle cx="94" cy="10" r="1.5" stroke="#FBBF24" />
        <circle cx="94" cy="10" r="0.5" fill="#FBBF24" />
        <text x="12" y="6" fill="#FBBF24" font-size="2" font-family="monospace">LAYER: TOP_COPPER | BUS_SPEED: 480MHz</text>
      </g>

      <!-- PCB Copper Traces -->
      <g stroke="#FBBF24" stroke-width="1.1" stroke-linecap="square" filter="url(#pcbGlow)">
        ${renderLines('#FBBF24', 1.1)}
      </g>

      <!-- Solder SMD Pads & Test Vias on Joints -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        const labels = ['GND', 'VCC', 'TX', 'RX', 'GPIO4', 'GPIO5', 'PWM1', 'SCL', 'SDA', 'BGA', 'INT1', 'MOSI', 'MISO', 'SCK', 'CS', 'ADC1', 'ADC2', 'D+', 'D-', 'RST', 'BOOT'];
        return `
          <g transform="translate(${x}, ${y})">
            <!-- SMD Square Pad -->
            <rect x="-1.2" y="-1.2" width="2.4" height="2.4" fill="#FBBF24" stroke="#FFFFFF" stroke-width="0.3" filter="url(#pcbGlow)" />
            <circle cx="0" cy="0" r="0.4" fill="#000000" />
            ${isTip ? `<text x="2.5" y="0.6" fill="#FBBF24" font-size="1.5" font-family="monospace">${labels[Number(i)]}</text>` : ''}
          </g>
        `;
      }).join('\n')}

      <!-- Palm Center: Microprocessor BGA Socket -->
      <g transform="translate(${P[9][0]}, ${P[9][1]})" filter="url(#pcbGlow)">
        <!-- Square IC package -->
        <rect x="-4.5" y="-4.5" width="9" height="9" fill="rgba(251,191,36,0.15)" stroke="#FBBF24" stroke-width="0.6" />
        <circle cx="0" cy="0" r="5.6" fill="none" stroke="#FBBF24" stroke-width="1.2" stroke-dasharray="35.1" stroke-dashoffset="7.7" stroke-linecap="round" />
        <rect x="-2.5" y="-2.5" width="5" height="5" fill="#FBBF24" />
        <text x="0" y="0.8" fill="#000000" font-size="2" font-weight="bold" font-family="monospace" text-anchor="middle">78%</text>
        <text x="0" y="8" fill="#FBBF24" font-size="1.7" font-family="monospace" text-anchor="middle">CPE-CORE</text>
      </g>
    `
  },
  {
    id: 9,
    key: 'sonar_radar',
    title: 'TACTICAL SONAR RADAR PING',
    thaiTitle: 'แบบที่ 9: เรดาร์โซนาร์ยุทธวิธี (Phosphor Radar Scope)',
    description: 'คลื่นโซนาร์วงกลมขยายตัวเป็นระลอก (Concentric Echo Ripples) สีเขียวฟอสฟอรัส (#22C55E) สไตล์จอมอนิเตอร์การบินและเรือดำน้ำ พร้อมเข็มเรดาร์กวาด 360° ให้ความแม่นยำสูง',
    badgeColor: '#22C55E',
    hudBorder: '#22C55E',
    renderSvg: () => `
      <defs>
        <filter id="radarGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.7" flood-color="#22C55E" flood-opacity="0.85" />
        </filter>
      </defs>

      <!-- Radar Scope Graticule -->
      <g stroke="#22C55E" stroke-width="0.4" fill="none" opacity="0.6">
        <circle cx="${P[9][0]}" cy="${P[9][1]}" r="20" stroke-dasharray="2 2" />
        <circle cx="${P[9][0]}" cy="${P[9][1]}" r="35" stroke-dasharray="2 2" opacity="0.3" />
        <line x1="${P[9][0] - 25}" y1="${P[9][1]}" x2="${P[9][0] + 25}" y2="${P[9][1]}" stroke-dasharray="1 1" />
        <line x1="${P[9][0]}" y1="${P[9][1] - 25}" x2="${P[9][0]}" y2="${P[9][1] + 25}" stroke-dasharray="1 1" />
        <text x="8" y="6" fill="#22C55E" font-size="2" font-family="monospace">RADAR BRG: 048° | RNG: 0.85m | ECHO: STRONG</text>
      </g>

      <!-- Phosphor Green Bones -->
      <g stroke="#22C55E" stroke-width="1.2" stroke-linecap="round" filter="url(#radarGlow)">
        ${renderLines('#22C55E', 1.2)}
      </g>

      <!-- Target Blip Nodes -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <g transform="translate(${x}, ${y})">
            <circle cx="0" cy="0" r="${isTip ? 1.4 : 0.9}" fill="#86EFAC" stroke="#22C55E" stroke-width="0.3" filter="url(#radarGlow)" />
            ${isTip ? `<circle cx="0" cy="0" r="2.4" fill="none" stroke="#22C55E" stroke-width="0.3" stroke-dasharray="0.8 0.8" />` : ''}
          </g>
        `;
      }).join('\n')}

      <!-- Palm Center: Active Sonar Ping Transmitter -->
      <g transform="translate(${P[9][0]}, ${P[9][1]})" filter="url(#radarGlow)">
        <!-- Concentric Sonar Ripples -->
        <circle cx="0" cy="0" r="10" fill="none" stroke="#22C55E" stroke-width="0.3" opacity="0.3" />
        <circle cx="0" cy="0" r="7.5" fill="none" stroke="#22C55E" stroke-width="0.4" opacity="0.5" />
        <!-- Rotating Sweep Arm -->
        <line x1="0" y1="0" x2="6.5" y2="-6.5" stroke="#86EFAC" stroke-width="0.9" />
        <!-- Progress Ring -->
        <circle cx="0" cy="0" r="5.2" fill="rgba(34,197,94,0.15)" stroke="#22C55E" stroke-width="1.3" stroke-dasharray="32.6" stroke-dashoffset="7.2" stroke-linecap="round" />
        <text x="0" y="0.8" fill="#FFFFFF" font-size="2" font-weight="bold" font-family="monospace" text-anchor="middle">78%</text>
        <text x="0" y="8" fill="#22C55E" font-size="1.7" font-family="monospace" text-anchor="middle">PING LOCKED</text>
      </g>
    `
  },
  {
    id: 10,
    key: 'glassmorphism_frost',
    title: 'FROSTED GLASSMORPHISM CAPSULE',
    thaiTitle: 'แบบที่ 10: กระจกฝ้าพรีเมียม (Apple VisionOS Glass)',
    description: 'แคปซูลแก้วกึ่งโปร่งใส (Translucent Frosted Capsule) นุ่มนวล เคลือบกระจกฝ้าหรูหรา และวงแหวนของเหลวปรอท (Liquid Mercury Fill) มอบประสบการณ์อินเทอร์เฟซระดับพรีเมียมที่ดูสะอาดตาที่สุด',
    badgeColor: '#E2E8F0',
    hudBorder: '#94A3B8',
    renderSvg: () => `
      <defs>
        <filter id="softFrost" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="0.8" flood-color="#000000" flood-opacity="0.4" />
        </filter>
        <linearGradient id="glassPill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.85)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.25)" />
        </linearGradient>
      </defs>

      <!-- Soft Rounded Frosted Brackets -->
      <g stroke="rgba(255,255,255,0.6)" stroke-width="0.6" fill="none">
        <rect x="5" y="8" width="90" height="88" rx="8" stroke="rgba(255,255,255,0.15)" stroke-width="0.5" />
        <path d="M 6 20 A 6 6 0 0 1 20 6" stroke="#FFFFFF" stroke-width="0.9" />
        <path d="M 94 20 A 6 6 0 0 0 80 6" stroke="#FFFFFF" stroke-width="0.9" />
        <text x="8" y="5" fill="rgba(255,255,255,0.8)" font-size="2" font-family="sans-serif" font-weight="500">SPATIAL VISION · HAND TRACKING</text>
      </g>

      <!-- Glass Capsule Bones -->
      <g stroke="url(#glassPill)" stroke-width="1.8" stroke-linecap="round" filter="url(#softFrost)" opacity="0.9">
        ${renderLines('url(#glassPill)', 1.8)}
      </g>

      <!-- Floating Glass Beads on Joints -->
      ${Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `
          <g transform="translate(${x}, ${y})" filter="url(#softFrost)">
            <circle cx="0" cy="0" r="${isTip ? 1.6 : 1.1}" fill="#FFFFFF" stroke="rgba(255,255,255,0.8)" stroke-width="0.4" />
            <circle cx="-0.3" cy="-0.3" r="0.4" fill="#FFFFFF" opacity="0.8" />
          </g>
        `;
      }).join('\n')}

      <!-- Palm Center: Frosted Glass Lens with Liquid Fill -->
      <g transform="translate(${P[9][0]}, ${P[9][1]})" filter="url(#softFrost)">
        <circle cx="0" cy="0" r="5.6" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" stroke-width="0.6" />
        <!-- Liquid Progress Arc -->
        <circle cx="0" cy="0" r="5.6" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-dasharray="35.1" stroke-dashoffset="7.7" stroke-linecap="round" />
        <text x="0" y="0.8" fill="#FFFFFF" font-size="2.2" font-weight="600" font-family="sans-serif" text-anchor="middle">78%</text>
        <text x="0" y="8" fill="rgba(255,255,255,0.7)" font-size="1.6" font-family="sans-serif" text-anchor="middle">READY</text>
      </g>
    `
  }
];

// Master Render Function
async function renderAll() {
  console.log(`Starting Generation of 10 Hand Detection Preview Styles...`);
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  for (const style of STYLES) {
    console.log(`\n[Style ${style.id}/10] Rendering: ${style.title}...`);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #000; width: 1280px; height: 720px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; overflow: hidden; }
    .stage { position: relative; width: 1280px; height: 720px; background: #05080E; overflow: hidden; display: flex; }
    
    /* Left Pillar (12.5%): 160px */
    .pillar-left { width: 160px; height: 100%; background: rgba(5,8,14,0.95); border-right: 1px solid rgba(255,255,255,0.1); padding: 18px 14px; color: #fff; z-index: 20; display: flex; flex-direction: column; justify-content: space-between; }
    
    /* Right Pillar (12.5%): 160px */
    .pillar-right { width: 160px; height: 100%; background: rgba(5,8,14,0.95); border-left: 1px solid rgba(255,255,255,0.1); padding: 18px 14px; color: #fff; z-index: 20; display: flex; flex-direction: column; justify-content: space-between; }
    
    /* Central 4:3 Viewport: 960px */
    .viewport { flex: 1; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; background: #000; overflow: hidden; }
    .camera-img { height: 100%; width: 100%; object-fit: cover; opacity: 0.88; filter: contrast(1.12) brightness(0.92); }
    
    /* Privacy Face Shield (PDPA compliance) */
    .face-shield { position: absolute; bottom: 0; left: 0; width: 220px; height: 210px; backdrop-filter: blur(28px); background: radial-gradient(circle at bottom left, rgba(5,8,14,0.98) 0%, rgba(5,8,14,0.7) 65%, transparent 100%); z-index: 6; }
    
    /* 4:3 Zone Hairline & Labels */
    .hud-header { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); border: 1px solid rgba(206,17,38,0.5); padding: 4px 18px; border-radius: 4px; color: #fff; font-size: 11px; font-family: monospace; letter-spacing: 2px; z-index: 30; }
    
    /* Style Presentation Top Banner */
    .style-banner { position: absolute; top: 44px; left: 50%; transform: translateX(-50%); background: rgba(11,15,23,0.92); border: 1px solid ${style.hudBorder}; padding: 6px 20px; border-radius: 30px; display: flex; align-items: center; gap: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); z-index: 30; }
    .style-num { font-size: 11px; font-weight: 800; font-family: monospace; background: ${style.badgeColor}; color: #000; padding: 2px 8px; border-radius: 12px; }
    .style-title { font-size: 12px; font-weight: 800; color: #FFFFFF; letter-spacing: 1.5px; }

    /* SVG Overlay Layer */
    .svg-layer { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 15; pointer-events: none; }

    /* Bottom HUD Status Telemetry Badge */
    .telemetry-badge { position: absolute; bottom: 18px; left: 24px; background: rgba(5,8,14,0.92); border: 1px solid ${style.hudBorder}; padding: 6px 16px; border-radius: 20px; color: #E2E8F0; font-size: 11px; font-family: monospace; display: flex; align-items: center; gap: 10px; z-index: 30; box-shadow: 0 4px 16px rgba(0,0,0,0.5); }
    .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: ${style.badgeColor}; }
  </style>
</head>
<body>
  <div class='stage'>
    <!-- Left Pillar (Branding & Telemetry) -->
    <div class='pillar-left'>
      <div>
        ${logoUri ? `<img src="${logoUri}" style="height: 38px; width: auto; margin-bottom: 8px;" />` : `<div style="color: #CE1126; font-weight: 900; font-size: 18px;">SWU CPE</div>`}
        <div style="font-size: 12px; font-weight: bold; color: #FFFFFF; line-height: 1.3;">SWU Computer<br>Engineering</div>
        <div style="font-size: 10px; font-weight: 600; color: #94A3B8; margin-top: 4px; letter-spacing: 1px;">OPEN HOUSE 2026</div>
      </div>
      <div style="font-size: 11px; color: #22D3EE; display: flex; flex-direction: column; gap: 10px; font-family: monospace;">
        <div style="border-left: 2px solid ${style.badgeColor}; padding-left: 8px;">
          <div style="color: #FFF;">1440×1080</div>
          <div style="color: #64748B; font-size: 9px;">RAW · 4:3 SENSOR</div>
        </div>
        <div style="border-left: 2px solid #10B981; padding-left: 8px;">
          <div style="color: #10B981;">60 FPS</div>
          <div style="color: #64748B; font-size: 9px;">VISION ENGINE OK</div>
        </div>
        <div style="border-left: 2px solid ${style.badgeColor}; padding-left: 8px;">
          <div style="color: ${style.badgeColor};">OPEN_PALM 78%</div>
          <div style="color: #64748B; font-size: 9px;">GESTURE LOCK</div>
        </div>
      </div>
    </div>

    <!-- Center Viewport (4:3 Live Camera Feed Zone) -->
    <div class='viewport'>
      <div class='hud-header'>4:3 CAPTURE ZONE · 1440×1080 RAW</div>
      
      <div class='style-banner'>
        <span class='style-num'>STYLE ${style.id} / 10</span>
        <span class='style-title'>${style.title}</span>
      </div>

      <!-- Camera Feed Base Image -->
      <img src='${dataUri}' class='camera-img' />

      <!-- Face Privacy Shield -->
      <div class='face-shield'></div>

      <!-- Vector SVG Detection Overlay -->
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="svg-layer">
        ${style.renderSvg()}
      </svg>

      <!-- Bottom HUD Telemetry Badge -->
      <div class='telemetry-badge'>
        <span class='pulse-dot'></span>
        <span>PRIMARY HAND · AREA 4.8% (OK)</span>
        <span style="color: #64748B;">|</span>
        <span style="color: ${style.badgeColor}; font-weight: bold;">OPEN_PALM 78% (HOLDING)</span>
      </div>
    </div>

    <!-- Right Pillar (Gesture Guide) -->
    <div class='pillar-right'>
      <div style="font-size: 11px; font-weight: 800; color: #94A3B8; letter-spacing: 1.5px;">GESTURE GUIDE</div>
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div>
          <div style="color: #CE1126; font-size: 10px; font-weight: 800; font-family: monospace;">01</div>
          <div style="color: #FFF; font-size: 12px; font-weight: 700; margin-top: 2px;">แบมือค้าง</div>
          <div style="color: #94A3B8; font-size: 11px;">1.5 วินาที</div>
          <div style="color: #64748B; font-size: 9px; margin-top: 2px; font-family: monospace;">HOLD TO START</div>
        </div>
        <div>
          <div style="color: #CE1126; font-size: 10px; font-weight: 800; font-family: monospace;">02</div>
          <div style="color: #FFF; font-size: 12px; font-weight: 700; margin-top: 2px;">โพสอิสระ</div>
          <div style="color: #94A3B8; font-size: 11px;">ช่วง 3..2..1</div>
          <div style="color: #64748B; font-size: 9px; margin-top: 2px; font-family: monospace;">POSE FREELY</div>
        </div>
        <div>
          <div style="color: #CE1126; font-size: 10px; font-weight: 800; font-family: monospace;">03</div>
          <div style="color: #FFF; font-size: 12px; font-weight: 700; margin-top: 2px;">รับรูปที่</div>
          <div style="color: #94A3B8; font-size: 11px;">จอหมายเลข 2</div>
          <div style="color: #64748B; font-size: 9px; margin-top: 2px; font-family: monospace;">SCAN AT SCREEN 2</div>
        </div>
      </div>
      <div style="font-size: 10px; color: #64748B; font-family: monospace;">KEY: [P] [F] [S]</div>
    </div>
  </div>
</body>
</html>`;

    const tempHtml = `C:/Users/satit/AppData/Local/Temp/preview_style_${style.id}.html`;
    const tempPng = `C:/Users/satit/AppData/Local/Temp/preview_style_${style.id}.png`;
    fs.writeFileSync(tempHtml, html);

    const cmd = `"${edgePath}" --headless=new --disable-gpu --user-data-dir="C:\\Users\\satit\\AppData\\Local\\Temp\\edgetemp" --window-size=1280,720 --screenshot="${tempPng}" "file:///${tempHtml}"`;
    execSync(cmd, { stdio: 'pipe' });

    // Copy to brain artifact directory with descriptive and numbered names
    const destName = `preview_style_${String(style.id).padStart(2, '0')}_${style.key}.png`;
    const destNumbered = `preview_style_${style.id}.png`;
    const brainDest = path.join(brainDir, destName);
    const brainNumberedDest = path.join(brainDir, destNumbered);

    fs.copyFileSync(tempPng, brainDest);
    fs.copyFileSync(tempPng, brainNumberedDest);
    console.log(` -> Saved successfully: ${destName} (${fs.statSync(brainDest).size} bytes)`);
  }

  console.log('\nAll 10 preview styles generated and verified successfully in artifact directory!');
}

renderAll().catch(err => {
  console.error('Error during preview generation:', err);
  process.exit(1);
});
