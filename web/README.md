# SWU Open House Photo Booth (Web App)

Next.js app for the AI Photo Booth: the kiosk captures a photo when a visitor holds an open palm, shows a QR code, and the visitor edits the photo (filters + frames) on their phone.

## Run

```powershell
cd web
npm install
npm run dev
```

- Kiosk: http://localhost:3000/kiosk (open on the computer with the webcam)
- Phones must be on the same Wi-Fi as the kiosk computer. Allow Node.js through Windows Firewall when prompted.

`npm run dev` / `npm run build` first run `scripts/setup-assets.mjs`, which copies the MediaPipe WASM files into `public/mediapipe/` and downloads the hand model (~8 MB, internet needed once).

## Status

- [x] Step 1: project setup
- [ ] Step 2: kiosk camera + hand gesture detection
- [ ] Step 3: capture → upload → QR → phone shows photo
- [ ] Step 4: 6 color filters + brightness
- [ ] Step 5: 3 frames + save/share
- [ ] Step 6: 7-day auto-purge, error states, polish
