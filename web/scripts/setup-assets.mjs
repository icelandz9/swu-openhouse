// Copies MediaPipe WASM files into public/ and downloads the hand and face models once,
// so the kiosk can load everything from its own server (works without internet
// after the first run).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcWasm = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const outDir = path.join(root, "public", "mediapipe");
const outWasm = path.join(outDir, "wasm");
const MODELS = [
  {
    name: "Hand model",
    file: "hand_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  },
  {
    name: "Face model (meme stickers)",
    file: "face_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  },
];

fs.mkdirSync(outWasm, { recursive: true });
for (const file of fs.readdirSync(srcWasm)) {
  fs.copyFileSync(path.join(srcWasm, file), path.join(outWasm, file));
}
console.log("[setup-assets] MediaPipe WASM copied");

for (const model of MODELS) {
  const modelPath = path.join(outDir, model.file);
  if (fs.existsSync(modelPath)) {
    console.log(`[setup-assets] ${model.name} already present`);
    continue;
  }
  console.log(`[setup-assets] Downloading ${model.name}...`);
  const res = await fetch(model.url);
  if (!res.ok) {
    console.error(`[setup-assets] ${model.name} download failed: HTTP ${res.status}`);
    process.exit(1);
  }
  fs.writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()));
  console.log(`[setup-assets] ${model.name} saved`);
}

import "./generate-assets.mjs";
