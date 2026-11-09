import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const PORT = 8899;
const projectDir = 'c:/Users/satit/OneDrive/Desktop/PhotoBooth-OpenHouseSWU';
const imgPath = 'C:/Users/satit/.gemini/antigravity/brain/e8cf40fb-311f-4066-aa48-0e4da4416106/.user_uploaded/media_1794236085139_5fd28269.jpg';
const imgBuf = fs.readFileSync(imgPath);

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script type="module">
    import { FilesetResolver, HandLandmarker } from "/vision_bundle.mjs";

    async function run() {
      try {
        console.log("Starting vision tasks resolver...");
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        console.log("Creating HandLandmarker...");
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/model.task",
            delegate: "CPU"
          },
          runningMode: "IMAGE",
          numHands: 2
        });

        console.log("Detecting on image...");
        const img = document.getElementById("target");
        const results = landmarker.detect(img);

        console.log("RESULTS:", results);

        // POST back to server
        await fetch("/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(results)
        });
      } catch (e) {
        console.error("DETECTION_ERROR:", e.toString(), e.stack);
        fetch("/error", { method: "POST", body: e.toString() });
      }
    }

    window.addEventListener("load", run);
  </script>
</head>
<body>
  <img id="target" src="/image.jpg" width="1024" height="576" />
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else if (url === '/vision_bundle.mjs') {
    const p = path.join(projectDir, 'web/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(fs.readFileSync(p));
  } else if (url.startsWith('/wasm/')) {
    const file = url.replace('/wasm/', '');
    const p = path.join(projectDir, 'web/public/mediapipe/wasm', file);
    if (fs.existsSync(p)) {
      const mime = file.endsWith('.wasm') ? 'application/wasm' : 'application/javascript';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(fs.readFileSync(p));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  } else if (url === '/model.task') {
    const p = path.join(projectDir, 'web/public/mediapipe/hand_landmarker.task');
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.end(fs.readFileSync(p));
  } else if (url === '/image.jpg') {
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(imgBuf);
  } else if (url === '/result' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      fs.writeFileSync('C:/Users/satit/.gemini/antigravity/brain/e8cf40fb-311f-4066-aa48-0e4da4416106/true_mediapipe_landmarks.json', body);
      console.log('Successfully saved true_mediapipe_landmarks.json!');
      res.writeHead(200);
      res.end('OK');
      setTimeout(() => process.exit(0), 500);
    });
  } else if (url === '/error' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.error('Browser error:', body);
      res.writeHead(200);
      res.end('OK');
      process.exit(1);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cmd = `"${edgePath}" --headless=new --disable-gpu --user-data-dir="C:\\Users\\satit\\AppData\\Local\\Temp\\edgetemp" "http://localhost:${PORT}/index.html"`;
  exec(cmd, (err) => {
    if (err) console.error('Edge execution error:', err);
  });
});
