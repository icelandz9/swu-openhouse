// Copies MediaPipe WASM files into public/ and downloads the hand model once,
// so the kiosk can load everything from its own server (works without internet
// after the first run).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcWasm = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const outDir = path.join(root, "public", "mediapipe");
const outWasm = path.join(outDir, "wasm");
const modelPath = path.join(outDir, "hand_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// 1. Copy MediaPipe WASM binaries if node_modules is present
if (fs.existsSync(srcWasm)) {
  fs.mkdirSync(outWasm, { recursive: true });
  for (const file of fs.readdirSync(srcWasm)) {
    fs.copyFileSync(path.join(srcWasm, file), path.join(outWasm, file));
  }
  console.log("[setup-assets] MediaPipe WASM copied");
} else {
  console.warn("[setup-assets] Warning: '@mediapipe/tasks-vision' not found in node_modules. Please ensure 'npm install' was run.");
}

// 2. Validate and download hand landmarker model (atomic write + size verification)
const MIN_MODEL_SIZE = 1_000_000; // Expected size ~8-9MB
let modelValid = false;

if (fs.existsSync(modelPath)) {
  try {
    const stats = fs.statSync(modelPath);
    if (stats.size >= MIN_MODEL_SIZE) {
      modelValid = true;
      console.log(`[setup-assets] Hand model already present & verified (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
    } else {
      console.warn(`[setup-assets] Corrupted or incomplete model file found (${stats.size} bytes). Re-downloading...`);
      fs.unlinkSync(modelPath);
    }
  } catch (err) {
    console.warn("[setup-assets] Error checking existing model, will re-download:", err.message);
  }
}

if (!modelValid) {
  console.log("[setup-assets] Downloading hand model from official CDN...");
  fs.mkdirSync(outDir, { recursive: true });
  const tempPath = `${modelPath}.tmp-${Date.now()}`;
  
  let success = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(MODEL_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      if (buffer.length < MIN_MODEL_SIZE) {
        throw new Error(`Incomplete buffer downloaded: ${buffer.length} bytes`);
      }

      fs.writeFileSync(tempPath, buffer);
      fs.renameSync(tempPath, modelPath);
      console.log(`[setup-assets] Hand model saved & verified (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
      success = true;
      break;
    } catch (e) {
      console.warn(`[setup-assets] Download attempt ${attempt}/3 failed: ${e.message}`);
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  if (!success) {
    console.warn("[setup-assets] Notice: Could not download local model. MediaPipe will fallback to CDN during browser execution.");
  }
}

// 3. Generate design frames and ML gesture weights
import "./generate-assets.mjs";
