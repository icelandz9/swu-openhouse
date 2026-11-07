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

fs.mkdirSync(outWasm, { recursive: true });
for (const file of fs.readdirSync(srcWasm)) {
  fs.copyFileSync(path.join(srcWasm, file), path.join(outWasm, file));
}
console.log("[setup-assets] MediaPipe WASM copied");

if (fs.existsSync(modelPath)) {
  console.log("[setup-assets] Hand model already present");
} else {
  console.log("[setup-assets] Downloading hand model...");
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    console.error(`[setup-assets] Model download failed: HTTP ${res.status}`);
    process.exit(1);
  }
  fs.writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()));
  console.log("[setup-assets] Hand model saved");
}

import "./generate-assets.mjs";
