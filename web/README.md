# SWU Open House Photo Booth — Web App (MVP)

เว็บแอปตู้ถ่ายรูปสำหรับงานเปิดบ้าน มศว: ผู้ร่วมงานแบมือหน้ากล้องเพื่อถ่ายรูป สแกน QR รับรูป แล้วแต่งฟิลเตอร์และกรอบรูปต่อบนมือถือของตัวเอง

> พัฒนาบน branch `feature/photo-booth-mvp` — ยังไม่ merge เข้า `main`

ภาพรวมระบบและขั้นตอนการทำงานทั้งหมดดูได้ที่ [README หลัก](../README.md) — ไฟล์นี้เก็บเฉพาะรายละเอียดของตัวเว็บแอป

## เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| หน้าเว็บ + API | Next.js 15 + TypeScript | ทำ frontend และ backend ในโปรเจกต์เดียว ตามเอกสาร Task 01 |
| จับท่ามือ | MediaPipe Hand Landmarker | มีโมเดลจุดบนมือ 21 จุดพร้อมใช้ รันบน GPU ในเบราว์เซอร์ แม่นกว่าและง่ายกว่า OpenCV |
| QR Code | `qrcode` | สร้าง QR ฝั่งเบราว์เซอร์ |
| ฟิลเตอร์ + กรอบ | HTML5 Canvas | ไม่ต้องโหลด library หนักบนมือถือ |
| เก็บรูป | ไฟล์ในเครื่องตู้ (`web/data/`) | MVP ใช้ในเครื่องก่อน ภายหลังย้ายไป Cloudflare R2 |

## หน้าเว็บ

### หน้าตู้ `/kiosk` — เปิดบนคอมที่ต่อกล้อง
| ค่า | กำหนด |
|---|---|
| ท่าที่ใช้ถ่าย | แบมือ (Open Palm) ค้าง 1.5 วินาที — นับเฉพาะมือที่ใหญ่/ใกล้กล้องที่สุด |
| นับถอยหลัง | 3..2..1 + เสียงบี๊บ + จอกะพริบขาว |
| พรีวิว | 10 วินาที, ถ่ายใหม่ได้ 1 ครั้ง |
| สัดส่วนภาพ | 4:3 (Center Crop 1440x1080 พิกเซล จากกล้อง 1080p) |
| กรณีเน็ตหลุด | หยุดรอสัญญาณเน็ต (Blocking Mode: "กำลังรอสัญญาณอินเทอร์เน็ต...") + ปุ่ม Staff PIN |
| หน้าจอ QR | 20 วินาที + ปุ่ม "คนถัดไป" (ไม่แสดงรหัสตัวอักษรบนจอตู้) |
| สำรอง | ปุ่มแตะเพื่อถ่าย, แจ้งสตาฟเมื่อไม่พบกล้อง/ไม่ได้รับสิทธิ์ |

### หน้ามือถือ `/p/OPH-XXXX` — เปิดจากการสแกน QR
| ส่วน | รายละเอียด |
|---|---|
| หัวเว็บ | แสดงรหัส OPH-XXXX ไว้ดึงรูปย้อนหลัง |
| ฟิลเตอร์ | Original, Warm, Cool Minimal, Film Vintage, Classic B&W, Rosy Bright + ปรับความสว่าง ±30% |
| กรอบ (CPE 3 แบบ) | CPE SWU Official Classic, CPE Youthful Tech & Circuit, CPE Photostrip Minimalist |
| สัดส่วนภาพ | 4:3 สอดคล้องกับหน้าตู้ |
| ส่งออก | บันทึก JPEG คุณภาพ 0.92 / แชร์ (iOS เลือก "บันทึกรูปภาพ" ลงอัลบั้ม) |

## API

| Method | Path | หน้าที่ |
|---|---|---|
| `POST` | `/api/photos` | รับรูปจากตู้ สร้างรหัส `OPH-XXXX` ที่ไม่ซ้ำ บันทึกไฟล์ |
| `GET` | `/api/photos/OPH-XXXX` | ส่งรูปให้มือถือ ถ้าหมดอายุตอบ `410 Gone` |
| `GET` | `/api/config` | บอก URL ของเครื่องตู้ในวง LAN สำหรับใส่ใน QR |

- รหัสสั้นใช้ตัวอักษร `A-Z` และ `2-9` โดยตัด `0, O, 1, I` ออกเพื่อไม่ให้สับสน
- **PDPA:** รูปเก็บไว้ 7 วัน หลังจากนั้นดึงไม่ได้และถูกลบอัตโนมัติ

## วิธีรัน

ต้องมี [Node.js LTS](https://nodejs.org) ก่อน

```powershell
cd web
npm install
npm run dev
```

| เปิดที่ | ใช้ทำอะไร |
|---|---|
| http://localhost:3000 | หน้าแรก |
| http://localhost:3000/kiosk | หน้าตู้ (เปิดบนคอมที่ต่อกล้อง) |

- `npm run dev` จะรัน `scripts/setup-assets.mjs` ก่อนทุกครั้ง เพื่อคัดลอกไฟล์ MediaPipe และโหลดโมเดลจับมือ (~8 MB) มาไว้ใน `public/mediapipe/` — ต้องมีเน็ตแค่ครั้งแรก
- **มือถือต้องต่อ Wi-Fi วงเดียวกับคอมตู้** QR จะชี้ไปที่ IP ของคอม เช่น `http://192.168.1.10:3000/p/OPH-AB12`
- ครั้งแรก Windows อาจถามสิทธิ์ Firewall ให้กด **Allow**

## โครงสร้างโฟลเดอร์

```
web/
├── app/
│   ├── page.tsx                หน้าแรก
│   ├── kiosk/page.tsx          [คนที่ 2] จอที่ 1: ถ่ายรูป (ท่ามือ, นับ 3-2-1, พรีวิว 10 วิ)
│   ├── display/page.tsx        [คนที่ 2] จอที่ 2: ซ้าย 30% QR / ขวา 70% Photo Wall
│   ├── p/[code]/page.tsx       [คนที่ 3] มือถือ: ฟิลเตอร์ + กรอบ + บันทึก
│   ├── find/page.tsx           [คนที่ 3] ค้นรูปด้วยรหัส OPH-XXXX
│   ├── admin/page.tsx          [คนที่ 3] จอ Laptop: แดชบอร์ดสตาฟ
│   └── api/
│       ├── photos/             [คนที่ 3] POST บันทึกรูป
│       ├── photos/[code]/      [คนที่ 3] GET ดึงรูปตามรหัส
│       └── health/             [คนที่ 3] ตรวจสถานะระบบ
├── lib/
│   ├── contracts.ts            [ส่วนกลาง] Type, ค่าเวลา KIOSK_TIMING, Event ข้ามจอ
│   ├── ai-vision/              [คนที่ 1] useWebcamStream, useMediaPipeHand, gestureRules, depthAreaFilter, useGestureTrigger
│   ├── kiosk/                  [คนที่ 2] kioskStateMachine, useKioskFSM, centerCropper, broadcastBus
│   ├── mobile/                 [คนที่ 3] colorFilters, canvasCompositor, useCanvasCompositor, shortCodeGenerator
│   └── storage/                [คนที่ 3] IPhotoStorage, LocalStorageAdapter, CloudflareR2Adapter, storageService
├── public/
│   ├── frames/                 [คนที่ 3] กรอบ CPE 3 แบบ PNG 4:3 (ดู README ในโฟลเดอร์)
│   └── mediapipe/              ไฟล์โมเดล (สร้างอัตโนมัติ ไม่ commit)
├── scripts/setup-assets.mjs    เตรียมไฟล์ MediaPipe
├── postcss.config.mjs          เปิดใช้ Tailwind CSS
└── data/                       รูปที่ถ่าย (ไม่ commit — ข้อมูลส่วนบุคคล PDPA)
```

## การตรวจท่ามือ

`useMediaPipeHand` คืนข้อมูลของแต่ละมือเป็น array ลำดับเดียวกัน ส่งเข้า `classifyGesture` ได้ตรง ๆ:

```ts
const { hands, worldHands, handedness } = useMediaPipeHand(video, enabled);

const gesture = classifyGesture(
  hands[i],
  worldHands[i],
  handedness[i],
  video.videoWidth / video.videoHeight
);
```

| ผลลัพธ์ | เงื่อนไข |
|---|---|
| `OPEN_PALM` | นิ้วเหยียดครบ 5 นิ้ว และหันฝ่ามือเข้ากล้อง (หลังมือได้ `NONE`) |
| `FIST` | นิ้วทั้ง 4 พับ และนิ้วโป้งไม่ชูออกมา |
| `PEACE_SIGN` | นิ้วชี้กับนิ้วกลางเหยียด นิ้วนางกับนิ้วก้อยพับ |

- ตรวจได้แม้มือเอียง เพราะวัดจากระยะห่างจากข้อมือ ไม่ได้เทียบแกน y
- ใช้ได้กับภาพที่กลับด้านและไม่กลับด้าน
- **ยังไม่ได้ต่อเข้าหน้า `/kiosk`** และยังไม่ได้ทดสอบในเบราว์เซอร์ ทดสอบแล้วเฉพาะตรรกะกับพิกัดมือจากรูปจริง
- `useGestureTrigger` ยังรีเซ็ตเวลาค้างมือทันทีเมื่อท่าหลุดเฟรมเดียว ซึ่งเกิดขึ้นจริงกับกล้อง ตอนต่อเข้าตู้ควรทำให้ผลนิ่งก่อน เช่น ใช้เสียงข้างมากของ 5 เฟรมล่าสุดแบบ [`fivepalm_shutter.py`](../scripts/model-training/fivepalm_shutter.py)

เดโมบนเครื่องสำหรับลองกติกาเดียวกันกับกล้องจริงอยู่ที่ [scripts/model-training](../scripts/model-training/README.md)

## ลำดับการพัฒนา

| ขั้น | งาน | สถานะ |
|---|---|---|
| 1 | ตั้งโปรเจกต์ Next.js + ติดตั้ง library | ✅ เสร็จ |
| 2 | หน้าตู้: เปิดกล้อง + จับท่ามือ + วงความคืบหน้า (ทดสอบกล้องจริง) | ⬜ |
| 3 | ครบเส้นทาง: นับถอยหลัง → ถ่าย → พรีวิว → อัปโหลด → QR → มือถือเห็นรูป | ⬜ |
| 4 | ฟิลเตอร์ 6 แบบ + แถบปรับความสว่าง | ⬜ |
| 5 | กรอบรูป 3 แบบ + บันทึก/แชร์ | ⬜ |
| 6 | ลบรูปอัตโนมัติ 7 วัน, หน้าแจ้ง error, ปรับหน้าตา | ⬜ |

ทุกขั้น commit บน branch นี้ และทดสอบรันก่อนไปขั้นถัดไป

## ยังไม่ทำในรอบ MVP

- **Cloudflare R2** — ตอนนี้เก็บรูปในเครื่องตู้ (ต้องมีบัญชี + key ก่อน)
- **หน้า `/admin` ของสตาฟ** — ดูรูปย้อนหลังแล้วเปิด QR ใหม่ให้น้องที่สแกนไม่ทัน
- **สลับภาษา TH / EN**
- **โลโก้และกรอบ มศว ของจริง** — ตอนนี้วาดกรอบด้วยโค้ด ถ้ามีไฟล์ PNG จะเปลี่ยนมาใช้แทน

## เอกสารที่เกี่ยวข้อง

- [Requirements Specification (Task 01)](../ducument-sathit/task01/task-01-requirements-specification.md)
- [Architecture & Sequence Flow (Task 01)](../ducument-sathit/task01/system-architecture-and-sequence-flow.md)
- [Task Backlog](../ducument-sathit/TASK_BACKLOG.md)
