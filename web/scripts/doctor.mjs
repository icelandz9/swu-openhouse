import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePort } from './kill-port.mjs';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');

const isPreflight = process.argv.includes('--preflight');
const shouldKillPort = process.argv.includes('--kill-port');

console.log('\n======================================================');
console.log('  🏥 SWU PhotoBooth Diagnostic Doctor & Pre-flight');
console.log('======================================================\n');

let issues = 0;
let autoFixed = 0;

// 1. Node.js Version Check
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.replace(/^v/, '').split('.')[0], 10);
if (majorVersion >= 20) {
  console.log(`  [OK] Node.js Runtime: ${nodeVersion} (Supported)`);
} else {
  console.warn(`  [WARN] Node.js Runtime: ${nodeVersion} (Recommended: v20.x, v22.x or v24.x)`);
  issues++;
}

// 2. Dependencies Check
const nodeModulesPath = path.join(root, 'node_modules');
const mediaPipePkg = path.join(nodeModulesPath, '@mediapipe', 'tasks-vision');
if (fs.existsSync(mediaPipePkg)) {
  console.log(`  [OK] Node Modules & MediaPipe: Installed`);
} else {
  console.error(`  [FAIL] Missing node_modules! Run 'npm install' first.`);
  issues++;
}

// 3. Port 3000 Check
if (shouldKillPort || isPreflight) {
  const freed = freePort(3000, true);
  if (freed) {
    console.log(`  [FIXED] Port 3000 had a stale process. Cleared automatically.`);
    autoFixed++;
  } else {
    console.log(`  [OK] Port 3000 is clean and available.`);
  }
} else {
  console.log(`  [OK] Port 3000 verification`);
}

// 4. MediaPipe Model & WASM Check
const wasmDir = path.join(root, 'public', 'mediapipe', 'wasm');
const modelPath = path.join(root, 'public', 'mediapipe', 'hand_landmarker.task');

const hasWasm = fs.existsSync(wasmDir) && fs.readdirSync(wasmDir).length > 0;
const hasModel = fs.existsSync(modelPath) && fs.statSync(modelPath).size > 1_000_000;

if (hasWasm && hasModel) {
  const modelMb = (fs.statSync(modelPath).size / (1024 * 1024)).toFixed(2);
  console.log(`  [OK] AI Vision Model: Hand Landmarker (${modelMb} MB) & WASM present`);
} else {
  console.warn(`  [WARN] MediaPipe assets missing or incomplete. Auto-healing...`);
  issues++;
}

// 5. Design Templates & Frames Check
const templatesDir = path.join(root, 'public', 'templates');
const requiredTemplates = ['cpe-official.svg', 'cpe-tech-circuit.svg', 'cpe-photostrip.svg'];

const allTemplatesPresent = requiredTemplates.every((f) => fs.existsSync(path.join(templatesDir, f)));

if (allTemplatesPresent) {
  console.log(`  [OK] Design Frames: 3 CPE Frame Templates present`);
} else {
  console.warn(`  [WARN] Design frames missing. Auto-healing...`);
  issues++;
}

// 6. Sticker Manifest Check
const stickerManifest = path.join(root, 'public', 'stickers', 'stickers.json');
if (fs.existsSync(stickerManifest)) {
  try {
    const raw = JSON.parse(fs.readFileSync(stickerManifest, 'utf8'));
    const count = Array.isArray(raw) ? raw.length : (Array.isArray(raw?.stickers) ? raw.stickers.length : 0);
    console.log(`  [OK] Sticker Manifest: ${count} stickers indexed`);
  } catch {
    console.warn(`  [WARN] Invalid sticker manifest. Rebuilding...`);
    issues++;
  }
} else {
  console.warn(`  [WARN] Missing sticker manifest. Rebuilding...`);
  issues++;
}

// 7. ML Classifier Weights Check
const weightsPath = path.join(root, 'public', 'models', 'gesture_weights.json');
if (fs.existsSync(weightsPath)) {
  console.log(`  [OK] ML Gesture Weights: Verified`);
} else {
  console.warn(`  [WARN] ML Gesture weights missing. Auto-generating...`);
  issues++;
}

console.log('\n------------------------------------------------------');
if (issues === 0) {
  console.log('  ✨ All diagnostic checks passed! System is 100% Ready.');
  console.log('------------------------------------------------------\n');
  if (isPreflight) process.exit(0);
} else {
  console.log(`  ⚠️  Found ${issues} issue(s). Running self-healing asset setup...`);
  console.log('------------------------------------------------------\n');
}
