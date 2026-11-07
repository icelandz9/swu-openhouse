// Lists the sticker images in public/stickers/ into public/stickers/stickers.json,
// so adding a sticker = dropping an image file into that folder (no code change).
// Runs automatically before `npm run dev` and `npm run build`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public", "stickers");
const IMAGE = /\.(png|webp|svg|gif|jpe?g)$/i;

fs.mkdirSync(dir, { recursive: true });
const stickers = fs
  .readdirSync(dir)
  .filter((file) => IMAGE.test(file))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

fs.writeFileSync(path.join(dir, "stickers.json"), JSON.stringify({ stickers }, null, 2) + "\n");
console.log(`[stickers] ${stickers.length} sticker(s) listed in public/stickers/stickers.json`);
