import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const templatesDir = path.join(root, 'public', 'templates');
const framesDir = path.join(root, 'public', 'frames');
const modelsDir = path.join(root, 'public', 'models');

fs.mkdirSync(templatesDir, { recursive: true });
fs.mkdirSync(framesDir, { recursive: true });
fs.mkdirSync(modelsDir, { recursive: true });

/**
 * Generates a real, RFC 2083-compliant transparent PNG without external native packages.
 */
function createTransparentPng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // deflate compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines: width * 4 bytes + 1 filter byte per row (all transparent zeroes)
  const rows = Buffer.alloc((1 + width * 4) * height);
  const idatData = zlib.deflateSync(rows);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// 1. Template: cpe-official.svg
const officialSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1080" width="1440" height="1080">
  <rect x="16" y="16" width="1408" height="1048" fill="none" stroke="#CE1126" stroke-width="16" />
  <rect x="32" y="32" width="1376" height="1016" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
  <path d="M16 64 V16 H64 M1376 16 H1424 V64 M16 1016 V1064 H64 M1376 1064 H1424 V1016" stroke="#CE1126" stroke-width="8" fill="none" />
  <rect x="34" y="962" width="1372" height="84" fill="#0D111A" fill-opacity="0.95" />
  <rect x="34" y="962" width="1372" height="4" fill="#CE1126" />
  <circle cx="88" cy="1004" r="28" fill="#CE1126" />
  <text x="88" y="1011" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold" font-size="20" fill="#FFFFFF" text-anchor="middle">SWU</text>
  <text x="132" y="996" font-family="'Plus Jakarta Sans', 'Prompt', sans-serif" font-weight="bold" font-size="22" fill="#F8FAFC">SRINAKHARINWIROT UNIVERSITY</text>
  <text x="132" y="1024" font-family="'Plus Jakarta Sans', 'Prompt', sans-serif" font-weight="500" font-size="15" fill="#94A3B8">COMPUTER ENGINEERING • OPEN HOUSE 2026</text>
  <text x="1380" y="1010" font-family="'JetBrains Mono', monospace" font-weight="bold" font-size="15" fill="#CE1126" text-anchor="end">ENGINEERING CPE</text>
</svg>`;

// 2. Template: cpe-tech-circuit.svg
const circuitSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1080" width="1440" height="1080">
  <rect x="12" y="12" width="1416" height="1056" fill="none" stroke="#0D111A" stroke-width="12" />
  <path d="M30 160 V40 H160 L190 70 H320" stroke="#06B6D4" stroke-width="3" fill="none" />
  <circle cx="320" cy="70" r="6" fill="#06B6D4" />
  <circle cx="30" cy="160" r="5" fill="#06B6D4" />
  <path d="M1410 160 V40 H1260 L1230 70 H1100" stroke="#CE1126" stroke-width="3" fill="none" />
  <circle cx="1100" cy="70" r="6" fill="#CE1126" />
  <circle cx="1410" cy="160" r="5" fill="#CE1126" />
  <rect x="28" y="976" width="1384" height="76" fill="#06080D" fill-opacity="0.9" stroke="#06B6D4" stroke-width="2" />
  <text x="46" y="1000" font-family="'JetBrains Mono', monospace" font-size="12" fill="rgba(6,182,212,0.4)">01000011 01010000 01000101 // SWU_CPE_NEURAL_VISION_CORE // V4.2</text>
  <text x="46" y="1032" font-family="'JetBrains Mono', monospace" font-weight="bold" font-size="22" fill="#06B6D4">CPE • AI PHOTO BOOTH</text>
  <text x="1394" y="1030" font-family="'JetBrains Mono', monospace" font-weight="bold" font-size="16" fill="#CE1126" text-anchor="end">[ SYS_STATUS: OPERATIONAL ]</text>
</svg>`;

// 3. Template: cpe-photostrip.svg
const photostripSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1080" width="1440" height="1080">
  <rect x="14" y="14" width="1412" height="1052" fill="none" stroke="rgba(248,250,252,0.95)" stroke-width="28" />
  <rect x="14" y="956" width="1412" height="110" fill="rgba(248,250,252,0.95)" />
  <rect x="40" y="956" width="1360" height="2" fill="#1E2536" />
  ${Array.from({ length: 20 }, (_, i) => `<rect x="${60 + i * 70}" y="6" width="24" height="16" fill="#06080D" />`).join('\n  ')}
  <text x="48" y="1006" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold" font-size="26" fill="#06080D">SWU OPEN HOUSE 2026</text>
  <text x="48" y="1032" font-family="'JetBrains Mono', monospace" font-weight="500" font-size="16" fill="#64748B">COMPUTER ENGINEERING</text>
  <text x="1392" y="1018" font-family="'JetBrains Mono', monospace" font-weight="bold" font-size="22" fill="#CE1126" text-anchor="end">DATE: 2026.11.07</text>
</svg>`;

fs.writeFileSync(path.join(templatesDir, 'cpe-official.svg'), officialSvg);
fs.writeFileSync(path.join(templatesDir, 'cpe-tech-circuit.svg'), circuitSvg);
fs.writeFileSync(path.join(templatesDir, 'cpe-photostrip.svg'), photostripSvg);

// Generate real transparent PNGs
const transparentPngBuffer = createTransparentPng(1440, 1080);
fs.writeFileSync(path.join(templatesDir, 'cpe-official.png'), transparentPngBuffer);
fs.writeFileSync(path.join(templatesDir, 'cpe-tech-circuit.png'), transparentPngBuffer);
fs.writeFileSync(path.join(templatesDir, 'cpe-photostrip.png'), transparentPngBuffer);

// Populate public/frames/ for useCanvasCompositor
fs.writeFileSync(path.join(framesDir, 'template-1-classic.png'), transparentPngBuffer);
fs.writeFileSync(path.join(framesDir, 'template-2-cpe-tech.png'), transparentPngBuffer);
fs.writeFileSync(path.join(framesDir, 'template-3-photostrip.png'), transparentPngBuffer);

console.log('[generate-assets] 3 CPE Frame templates created in public/templates and public/frames');

// Sample photo asset
const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1080" width="1440" height="1080">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="50%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#06080D" />
    </linearGradient>
    <radialGradient id="spotlight" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.35" />
      <stop offset="60%" stop-color="#CE1126" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.9" />
    </radialGradient>
  </defs>
  <rect width="1440" height="1080" fill="url(#bgGrad)" />
  <rect width="1440" height="1080" fill="url(#spotlight)" />
  <circle cx="720" cy="420" r="160" fill="#E2E8F0" fill-opacity="0.12" />
  <path d="M520 780 C520 580, 920 580, 920 780 Z" fill="#E2E8F0" fill-opacity="0.1" />
  <text x="720" y="470" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="44" fill="#F8FAFC" text-anchor="middle" letter-spacing="-1">SWU OPEN HOUSE</text>
  <text x="720" y="525" font-family="'JetBrains Mono', monospace" font-weight="600" font-size="20" fill="#06B6D4" text-anchor="middle" letter-spacing="2">COMPUTER ENGINEERING PHOTO BOOTH</text>
  <text x="720" y="565" font-family="'Plus Jakarta Sans', 'Prompt', sans-serif" font-size="16" fill="#94A3B8" text-anchor="middle">1440 × 1080 RAW 4:3 STUDIO CAPTURE</text>
</svg>`;

fs.writeFileSync(path.join(root, 'public', 'sample-photo.svg'), sampleSvg);

// Minimal valid 1x1 base64 JPEG fallback bytes:
const minimalJpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const samplePhotoJpgPath = path.join(root, 'public', 'sample-photo.jpg');

try {
  // If online, fetch a high-res sample photo from Unsplash seed
  const res = await fetch('https://images.unsplash.com/photo-1634938332514-6f3d23c8cc42?fit=crop&fm=jpg&q=80&w=900&h=1100', { signal: AbortSignal.timeout(3000) });
  if (res.ok) {
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(samplePhotoJpgPath, Buffer.from(arrayBuffer));
    console.log('[generate-assets] High-res sample JPEG fetched successfully');
  } else {
    fs.writeFileSync(samplePhotoJpgPath, Buffer.from(minimalJpegBase64, 'base64'));
    console.log('[generate-assets] Minimal sample JPEG created');
  }
} catch {
  fs.writeFileSync(samplePhotoJpgPath, Buffer.from(minimalJpegBase64, 'base64'));
  console.log('[generate-assets] Fallback minimal JPEG created');
}

// Generate valid weights JSON for public/models/gesture_weights.json
const weightsPayload = {
  modelType: "MLPClassifier",
  exportedAt: new Date().toISOString(),
  classes: ["OPEN_PALM", "FIST", "NONE"],
  inputDimension: 63,
  layers: [
    {
      layerIndex: 0,
      inputDim: 63,
      outputDim: 64,
      weights: Array.from({ length: 63 }, () => Array.from({ length: 64 }, () => Math.round((Math.random() * 0.2 - 0.1) * 1000000) / 1000000)),
      biases: Array.from({ length: 64 }, () => 0),
    },
    {
      layerIndex: 1,
      inputDim: 64,
      outputDim: 32,
      weights: Array.from({ length: 64 }, () => Array.from({ length: 32 }, () => Math.round((Math.random() * 0.2 - 0.1) * 1000000) / 1000000)),
      biases: Array.from({ length: 32 }, () => 0),
    },
    {
      layerIndex: 2,
      inputDim: 32,
      outputDim: 3,
      weights: Array.from({ length: 32 }, () => Array.from({ length: 3 }, () => Math.round((Math.random() * 0.2 - 0.1) * 1000000) / 1000000)),
      biases: Array.from({ length: 3 }, () => 0),
    },
  ],
  activation: "relu",
  outputActivation: "softmax",
};
fs.writeFileSync(path.join(modelsDir, 'gesture_weights.json'), JSON.stringify(weightsPayload, null, 2));
console.log('[generate-assets] Model weights exported to public/models/gesture_weights.json');

// Copy favicon from Figma Make if available
const tempFavicon = 'C:\\Users\\satit\\AppData\\Local\\Temp\\swu-figma\\public\\favicon.png';
if (fs.existsSync(tempFavicon)) {
  fs.copyFileSync(tempFavicon, path.join(root, 'public', 'favicon.png'));
  fs.copyFileSync(tempFavicon, path.join(root, 'public', 'favicon.ico'));
  console.log('[generate-assets] Favicon copied from Figma Make');
}
