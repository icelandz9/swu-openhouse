import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const brainDir = 'C:/Users/satit/.gemini/antigravity/brain/e8cf40fb-311f-4066-aa48-0e4da4416106';
const imgPath = path.join(brainDir, '.user_uploaded/media_1794236085139_5fd28269.jpg');
const b64 = fs.readFileSync(imgPath).toString('base64');
const dataUri = `data:image/jpeg;base64,${b64}`;

// Ground-truth MediaPipe Landmarks directly from the model execution
const P = {
  0: [56.92, 73.87],  // Wrist
  1: [49.35, 71.59],  // Thumb CMC
  2: [43.67, 63.48],  // Thumb MCP
  3: [40.49, 55.67],  // Thumb IP
  4: [37.77, 48.86],  // Thumb Tip
  5: [47.03, 46.12],  // Index MCP
  6: [44.03, 34.85],  // Index PIP
  7: [42.11, 27.84],  // Index DIP
  8: [40.37, 21.24],  // Index Tip
  9: [50.93, 43.53],  // Middle MCP
  10: [48.49, 30.43], // Middle PIP
  11: [46.89, 21.76], // Middle DIP
  12: [45.45, 14.15], // Middle Tip
  13: [54.84, 43.95], // Ring MCP
  14: [53.25, 31.98], // Ring PIP
  15: [52.01, 24.13], // Ring DIP
  16: [50.8, 17.26],  // Ring Tip
  17: [58.83, 46.55], // Pinky MCP
  18: [58.64, 36.56], // Pinky PIP
  19: [58.21, 29.82], // Pinky DIP
  20: [57.54, 23.61], // Pinky Tip
};

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb (0)
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index (1)
  [5, 9], [9, 10], [10, 11], [11, 12],  // Middle (2)
  [9, 13], [13, 14], [14, 15], [15, 16],// Ring (3)
  [13, 17], [17, 18], [18, 19], [19, 20],// Pinky (4)
  [0, 17],                              // Palm Base
];

// 10 Clean, Normal Color Styles (NO Laser Glow)
const STYLES = [
  {
    id: 1,
    key: 'classic_mediapipe_white',
    title: 'CLASSIC MEDIAPIPE WHITE',
    thaiTitle: 'แบบที่ 1: ขาวมาตรฐาน MediaPipe คลาสสิก (Solid Pure White)',
    desc: 'เส้นทึบสีขาวคมชัด 2.2px + จุดข้อต่อสีขาวขอบดำมาตรฐาน มองเห็นชัดเจนบนทุกเฉดสีผิว ไม่หลอกตา ไร้แสงฟุ้งเลเซอร์',
    tagColor: '#FFFFFF',
    tagBg: '#1E293B',
    renderSvg: () => {
      const lines = BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="#FFFFFF" stroke-width="0.5" stroke-linecap="round" />`).join('\n');
      const nodes = Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `<circle cx="${x}" cy="${y}" r="${isTip ? 0.9 : 0.6}" fill="#FFFFFF" stroke="#000000" stroke-width="0.18" />`;
      }).join('\n');
      return `${lines}\n${nodes}`;
    }
  },
  {
    id: 2,
    key: 'cpe_crimson_flat',
    title: 'CPE CRIMSON FLAT',
    thaiTitle: 'แบบที่ 2: แดงวิศวะ CPE คมกริบ (Solid CPE Crimson)',
    desc: 'เส้นสีแดงประจำภาควิชา CPE (#CE1126) สีทึบคมชัด ไม่ใส่เอฟเฟกต์เลเซอร์ จุดข้อต่อสีขาวตัดขอบแดง หนักแน่นและดูจริงจัง',
    tagColor: '#CE1126',
    tagBg: '#FFFFFF',
    renderSvg: () => {
      const lines = BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="#CE1126" stroke-width="0.55" stroke-linecap="round" />`).join('\n');
      const nodes = Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `<circle cx="${x}" cy="${y}" r="${isTip ? 0.95 : 0.65}" fill="#FFFFFF" stroke="#CE1126" stroke-width="0.22" />`;
      }).join('\n');
      return `${lines}\n${nodes}`;
    }
  },
  {
    id: 3,
    key: 'clean_cyan_teal',
    title: 'CLEAN CYAN TEAL',
    thaiTitle: 'แบบที่ 3: ฟ้าเทอร์ควอยซ์เรียบ (Flat Cyan / Teal)',
    desc: 'เส้นสีฟ้าสดสไตล์วิสัยทัศน์คอมพิวเตอร์ (#00BCD4) สีทึบไร้เงาฟุ้ง สบายตา ให้ความรู้สึกลื่นไหลและโมเดิร์น',
    tagColor: '#00BCD4',
    tagBg: '#0F172A',
    renderSvg: () => {
      const lines = BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="#00BCD4" stroke-width="0.52" stroke-linecap="round" />`).join('\n');
      const nodes = Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `<circle cx="${x}" cy="${y}" r="${isTip ? 0.9 : 0.6}" fill="#E0F7FA" stroke="#00838F" stroke-width="0.2" />`;
      }).join('\n');
      return `${lines}\n${nodes}`;
    }
  },
  {
    id: 4,
    key: 'emerald_green',
    title: 'EMERALD GREEN',
    thaiTitle: 'แบบที่ 4: เขียวเทอร์มินัลวิศวกรรม (Emerald Terminal Green)',
    desc: 'เส้นสีเขียวมรกต (#10B981) ทึบ คอนทราสต์สูง ตัดกับสีผิวและฉากหลังห้องได้ดีเยี่ยม จุด Landmark วงกลมขาวตัดขอบเขียว',
    tagColor: '#10B981',
    tagBg: '#064E3B',
    renderSvg: () => {
      const lines = BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="#10B981" stroke-width="0.52" stroke-linecap="round" />`).join('\n');
      const nodes = Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `<circle cx="${x}" cy="${y}" r="${isTip ? 0.9 : 0.6}" fill="#FFFFFF" stroke="#047857" stroke-width="0.2" />`;
      }).join('\n');
      return `${lines}\n${nodes}`;
    }
  },
  {
    id: 5,
    key: 'amber_orange',
    title: 'AMBER ORANGE',
    thaiTitle: 'แบบที่ 5: ส้มอำพันสว่างตา (Solid Amber Orange)',
    desc: 'เส้นสีส้มอำพัน (#F59E0B) สีทึบโทนอุ่น มองเห็นเด่นชัดบนหน้าจอตู้ Kiosk และไม่บดบังรายละเอียดใบหน้า',
    tagColor: '#F59E0B',
    tagBg: '#451A03',
    renderSvg: () => {
      const lines = BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="#F59E0B" stroke-width="0.52" stroke-linecap="round" />`).join('\n');
      const nodes = Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `<circle cx="${x}" cy="${y}" r="${isTip ? 0.9 : 0.6}" fill="#FEF3C7" stroke="#B45309" stroke-width="0.2" />`;
      }).join('\n');
      return `${lines}\n${nodes}`;
    }
  },
  {
    id: 6,
    key: 'cpe_dualtone_flat',
    title: 'CPE DUAL-TONE FLAT',
    thaiTitle: 'แบบที่ 6: ขาว-แดง ทูโทนวิศวะ (White Lines & Red Joints)',
    desc: 'เส้นกระดูกสีขาวล้วนสะอาดตา + จุดข้อต่อเป็นสีแดงเข้ม CPE (#CE1126) ตัดขอบขาว แยกแยะจุดข้อนิ้วได้คมชัดและมีเอกลักษณ์',
    tagColor: '#CE1126',
    tagBg: '#FFFFFF',
    renderSvg: () => {
      const lines = BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="#FFFFFF" stroke-width="0.5" stroke-linecap="round" />`).join('\n');
      const nodes = Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `<circle cx="${x}" cy="${y}" r="${isTip ? 1.0 : 0.65}" fill="#CE1126" stroke="#FFFFFF" stroke-width="0.22" />`;
      }).join('\n');
      return `${lines}\n${nodes}`;
    }
  },
  {
    id: 7,
    key: 'anatomical_multicolor',
    title: 'ANATOMICAL 5-FINGER COLOR',
    thaiTitle: 'แบบที่ 7: แยกสี 5 นิ้วตามกายวิภาค (Anatomical 5-Color)',
    desc: 'นิ้วโป้ง (ส้ม), นิ้วชี้ (ฟ้า), นิ้วกลาง (เขียว), นิ้วนาง (ม่วง), นิ้วก้อย (ชมพู), ฝ่ามือ (ขาว) ช่วยให้ทีมงานและผู้ใช้เห็นการจำแนกนิ้วแบบเรียลไทม์',
    tagColor: '#3B82F6',
    tagBg: '#1E1B4B',
    renderSvg: () => {
      // Finger color mapping
      const fingerColors = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#FFFFFF'];
      const boneColors = [
        0, 0, 0, 0, // thumb (orange)
        1, 1, 1, 1, // index (blue)
        2, 2, 2, 2, // middle (green)
        3, 3, 3, 3, // ring (purple)
        4, 4, 4, 4, // pinky (pink)
        5           // palm base (white)
      ];
      const lines = BONES.map(([s, e], idx) => {
        const c = fingerColors[boneColors[idx]];
        return `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="${c}" stroke-width="0.55" stroke-linecap="round" />`;
      }).join('\n');

      const nodes = Object.entries(P).map(([i, [x, y]]) => {
        const num = Number(i);
        let c = '#FFFFFF';
        if (num >= 1 && num <= 4) c = '#F59E0B';
        else if (num >= 5 && num <= 8) c = '#3B82F6';
        else if (num >= 9 && num <= 12) c = '#10B981';
        else if (num >= 13 && num <= 16) c = '#8B5CF6';
        else if (num >= 17 && num <= 20) c = '#EC4899';
        const isTip = [4, 8, 12, 16, 20].includes(num);
        return `<circle cx="${x}" cy="${y}" r="${isTip ? 0.95 : 0.6}" fill="${c}" stroke="#FFFFFF" stroke-width="0.18" />`;
      }).join('\n');
      return `${lines}\n${nodes}`;
    }
  },
  {
    id: 8,
    key: 'high_contrast_outline',
    title: 'HIGH-CONTRAST MONOCHROME',
    thaiTitle: 'แบบที่ 8: โมโนโครม คอนทราสต์สูง (High-Contrast Black & White)',
    desc: 'เส้นสีขาวสอดไส้แกนสีดำ (Double Line Outline) ช่วยให้อ่านตำแหน่งกระดูกมือได้ชัดเจน 100% ไม่ว่าฉากหลังจะเป็นสีมืดหรือสว่าง',
    tagColor: '#FFFFFF',
    tagBg: '#000000',
    renderSvg: () => {
      // Outer black stroke for contrast, inner white stroke
      const outerLines = BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="#000000" stroke-width="0.8" stroke-linecap="round" />`).join('\n');
      const innerLines = BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="#FFFFFF" stroke-width="0.45" stroke-linecap="round" />`).join('\n');
      const nodes = Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `<circle cx="${x}" cy="${y}" r="${isTip ? 1.0 : 0.65}" fill="#FFFFFF" stroke="#000000" stroke-width="0.25" />`;
      }).join('\n');
      return `${outerLines}\n${innerLines}\n${nodes}`;
    }
  },
  {
    id: 9,
    key: 'royal_engineering_navy',
    title: 'ENGINEERING ROYAL NAVY',
    thaiTitle: 'แบบที่ 9: น้ำเงินวิศวกรรมคราม (Royal Engineering Navy)',
    desc: 'เส้นสีน้ำเงินคราม (#1D4ED8) สีประจำงานวิศวกรรมสากล สุภาพ เป็นทางการ ชัดเจน และให้ความรู้สึกเป็นมืออาชีพ',
    tagColor: '#1D4ED8',
    tagBg: '#FFFFFF',
    renderSvg: () => {
      const lines = BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="#1D4ED8" stroke-width="0.52" stroke-linecap="round" />`).join('\n');
      const nodes = Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `<circle cx="${x}" cy="${y}" r="${isTip ? 0.9 : 0.6}" fill="#FFFFFF" stroke="#1D4ED8" stroke-width="0.22" />`;
      }).join('\n');
      return `${lines}\n${nodes}`;
    }
  },
  {
    id: 10,
    key: 'minimal_ring_nodes',
    title: 'MINIMAL RING NODES',
    thaiTitle: 'แบบที่ 10: วงแหวนโปร่งมินิมอล (Clean Thin & Ring Nodes)',
    desc: 'เส้นบาง 0.4px สีขาว + จุดข้อต่อเป็นวงแหวนโปร่งใส (Hollow Ring Nodes) ไม่บังผิวหนังและรอยพับของนิ้วมือ เหมาะสำหรับงานที่ต้องการความบางเบาสูงสุด',
    tagColor: '#CBD5E1',
    tagBg: '#1E293B',
    renderSvg: () => {
      const lines = BONES.map(([s, e]) => `<line x1="${P[s][0]}" y1="${P[s][1]}" x2="${P[e][0]}" y2="${P[e][1]}" stroke="rgba(255,255,255,0.85)" stroke-width="0.38" stroke-linecap="round" />`).join('\n');
      const nodes = Object.entries(P).map(([i, [x, y]]) => {
        const isTip = [4, 8, 12, 16, 20].includes(Number(i));
        return `<circle cx="${x}" cy="${y}" r="${isTip ? 0.85 : 0.55}" fill="none" stroke="#FFFFFF" stroke-width="0.25" />`;
      }).join('\n');
      return `${lines}\n${nodes}`;
    }
  }
];

async function generateCleanNormalPreviews() {
  console.log('Generating 10 clean, normal-color hand tracking previews with EXACT landmarks...');
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
    
    /* Clean Top Info Badge */
    .top-badge { position: absolute; top: 16px; left: 16px; background: rgba(15,23,42,0.92); border: 1px solid rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 20px; display: flex; align-items: center; gap: 10px; z-index: 20; box-shadow: 0 4px 14px rgba(0,0,0,0.5); }
    .num-pill { background: ${style.tagColor}; color: ${style.tagBg}; font-weight: 900; font-size: 10px; font-family: monospace; padding: 2px 7px; border-radius: 10px; }
    .title-text { color: #FFFFFF; font-weight: 700; font-size: 11px; letter-spacing: 0.8px; font-family: monospace; }

    /* Bottom Telemetry Badge */
    .bottom-badge { position: absolute; bottom: 16px; left: 16px; background: rgba(15,23,42,0.85); border: 1px solid rgba(255,255,255,0.15); padding: 5px 12px; border-radius: 16px; display: flex; align-items: center; gap: 8px; z-index: 20; }
    .color-dot { width: 7px; height: 7px; border-radius: 50%; background: ${style.tagColor}; }
    .info-text { color: #CBD5E1; font-size: 10px; font-family: monospace; }
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
      <span class='color-dot'></span>
      <span class='info-text'>21 EXACT MEDIAPIPE LANDMARKS · CLEAN NORMAL COLOR (NO LASER GLOW)</span>
    </div>
  </div>
</body>
</html>`;

    const tempHtml = `C:/Users/satit/AppData/Local/Temp/preview_clean_${style.id}.html`;
    const tempPng = `C:/Users/satit/AppData/Local/Temp/preview_clean_${style.id}.png`;
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

  console.log('\nAll 10 clean, normal color previews generated successfully!');
}

generateCleanNormalPreviews().catch(err => {
  console.error('Error generating previews:', err);
  process.exit(1);
});
