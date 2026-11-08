# Model Training (คนที่ 1 — AI & Vision)

สคริปต์ Python สำหรับทดสอบการตรวจท่ามือด้วยกล้องจริง เก็บข้อมูล และเทรนตัวจำแนกท่า (Task AI-01)

> **ตัวตู้จริงไม่ได้รันสคริปต์เหล่านี้** หน้าเว็บใช้กติกาใน [`web/lib/ai-vision/gestureRules.ts`](../../web/lib/ai-vision/gestureRules.ts) โฟลเดอร์นี้ใช้ทดสอบกติกาและเก็บข้อมูลมาวัดผล ถ้ากติกาแม่นไม่ถึง 95% ในสภาพแสงจริง ค่อยนำโมเดลที่เทรนนี้ไปใช้แทน

| ไฟล์ | หน้าที่ |
|---|---|
| `fivepalm_shutter.py` | เดโม: เปิดกล้อง บอกท่ามือบนจอ และแบมือค้างเพื่อถ่ายรูป |
| `gesture_gif_demo.py` | เดโมลองเล่น: ทำท่าหรือทำตาโต แล้วมีม GIF ขึ้นข้างภาพกล้อง และแบมือค้างเพื่อถ่ายรูปคู่กับมีม |
| `dataset_collector.py` | เปิดกล้อง แล้วบันทึกพิกัดมือ 21 จุด (63 ค่า) ลง `data/gestures.csv` |
| `train_gesture_classifier.py` | เทรนตัวจำแนกแบบ MLP จาก CSV และวัดความแม่นยำ (เป้าหมาย ≥ 95%) |
| `export_model_weights.py` | แปลงโมเดลเป็น `web/public/models/gesture_weights.json` ให้เว็บโหลดได้ |
| `swu_gesture_training_colab.ipynb` | เทรนและ export บน Google Colab โดยไม่ต้องติดตั้งอะไรในเครื่อง |

## สิ่งที่ต้องมี

- **Python 3.13** จาก [python.org](https://www.python.org/downloads/) (ทดสอบบน 3.13 และ Windows 11)
- **เว็บแคม** สำหรับ `fivepalm_shutter.py` และ `dataset_collector.py`
- **อินเทอร์เน็ต** ตอนติดตั้งและตอนรันครั้งแรก สคริปต์จะโหลดโมเดลมือ `hand_landmarker.task` (~8 MB) มาไว้ในโฟลเดอร์นี้

## ติดตั้ง (ทำครั้งเดียว)

รันใน PowerShell จาก root ของ repo:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r scripts/model-training/requirements.txt
```

ครั้งต่อไปที่เปิด Terminal ใหม่ ให้รันแค่บรรทัด `Activate.ps1`

## เปิดกล้องตรวจท่ามือ

```powershell
python scripts/model-training/fivepalm_shutter.py
```

ดูผลที่บรรทัด `GESTURE:` บนหน้าต่างกล้อง ถ้าจะปิด ให้คลิกหน้าต่างกล้องแล้วกด `q` หรือ `Esc` หรือกดปุ่ม X ของหน้าต่าง

| บนจอ | ความหมาย | วิธีตรวจ |
|---|---|---|
| `OPEN_PALM` | แบมือ 5 นิ้ว หันฝ่ามือเข้ากล้อง | นิ้วเหยียดครบ และใช้ซ้าย/ขวาของมือแยกฝ่ามือกับหลังมือ |
| `FIST` | กำมือ | นิ้วทั้ง 4 พับ และนิ้วโป้งไม่ชูออกมา |
| `BACK_OF_HAND` | แบมือแต่หันหลังมือ | ไม่สั่งถ่าย |
| `NONE` | ไม่เจอมือ หรือเป็นท่าอื่น | ไม่สั่งถ่าย |

แบมือค้าง 0.8 วินาทีจะเริ่มนับถอยหลัง 3 วินาทีแล้วถ่าย จากนั้นพัก 3 วินาที เมื่อเริ่มนับแล้วลดมือลงก็ยังถ่าย รูปจะบันทึกใน `scripts/model-training/captures/` ชื่อ `capture_ปี-เดือน-วัน_ชั่วโมง-นาที-วินาที.jpg` (เช่น `capture_2026-11-07_21-39-33.jpg`) และไม่ขึ้น Git

> ค่าค้าง 0.8 วินาทีใช้กับเดโมนี้เท่านั้น ตัวตู้จริงใช้ 1.5 วินาทีตาม [decisions.md](../../docs/decisions.md)

## เดโมมีม GIF (ลองเล่น)

ไม่เกี่ยวกับตัวตู้จริง ติดตั้งเหมือนหัวข้อด้านบน แล้วรัน:

```powershell
python scripts/model-training/gesture_gif_demo.py
```

ครั้งแรกจะดาวน์โหลดโมเดลท่าทางและโมเดลใบหน้าเพิ่ม ถ้าจะปิด ให้กด `q` หรือ `Esc`

แบมือค้าง 0.8 วินาทีเพื่อเริ่มนับถอยหลัง 3 วินาที แล้วโปรแกรมจะถ่ายรูปคุณคู่กับมีมที่ขึ้นอยู่ตอนนั้น รูปเก็บที่ `scripts/model-training/captures/` และไม่ขึ้น Git

วาง GIF ไว้ที่ `scripts/model-training/gifs/` แล้วเปิดโปรแกรมใหม่ ท่าที่ไม่มีไฟล์จะแสดงวงกลมแทน

| ท่า | ชื่อไฟล์ | วิธีทำ | ลำดับ |
|---|---|---|---|
| `SCOOBA` | `scooba.gif` | บีบจมูกด้วยนิ้วโป้งกับนิ้วชี้ และยกมืออีกข้างไว้ใกล้หน้า (ขึ้นทันที) | 1 |
| `SCARE` | `scare.gif` | ทำตาโตค้างไว้ | 2 |
| `OPEN_PALM` | `open_palm.gif` | แบมือหันฝ่ามือเข้ากล้อง (ค้างไว้เพื่อถ่ายรูป) | 3 |
| `FIST` | `fist.gif` | กำมือ | 3 |

ถ้าหลายท่าติดพร้อมกัน โปรแกรมจะแสดงท่าที่ลำดับต่ำกว่า แถวล่างซ้ายของจอบอกสถานะการบีบจมูก มืออีกข้าง และค่าตาโต

> `SCARE` ตั้งเกณฑ์ไว้ต่ำที่ `EYES_WIDE_ON = 0.02` จึงอาจขึ้นแม้ตาปกติ และบังท่าแบมือกับกำมือได้ ถ้าขึ้นบ่อยเกินไป ให้เพิ่มค่านี้ใน `gesture_gif_demo.py` เช่น 0.05 หรือ 0.20

โฟลเดอร์ `gifs/` ไม่ขึ้น Git เพราะมีมมักมีลิขสิทธิ์ ใครใช้ต้องหาไฟล์มาเอง

## เก็บข้อมูลและเทรนโมเดล

```powershell
# 1. เก็บข้อมูล: กด o = OPEN_PALM, f = FIST, n = NONE ค้างไว้เพื่อบันทึกต่อเนื่อง, q = ออก
python scripts/model-training/dataset_collector.py

# 2. เทรนและวัดผล (ต้องมีอย่างน้อยท่าละ 5 แถว)
python scripts/model-training/train_gesture_classifier.py

# 3. แปลงเป็น JSON ไปที่ web/public/models/
python scripts/model-training/export_model_weights.py
```

- ข้อมูลจะต่อท้ายไฟล์เดิม จึงเก็บหลายรอบได้
- `NONE` ต้องเห็นมือในภาพ ถ้าไม่เจอมือจะไม่มีอะไรถูกบันทึก ให้ทำท่าอื่น ๆ เช่น ชูนิ้วหรือมือครึ่งกำ
- เก็บจากหลายคน หลายระยะ และหลายสภาพแสง จำนวนมากแต่ซ้ำกันจะไม่ช่วยให้โมเดลดีขึ้น
- CSV เก็บเฉพาะพิกัดมือ ไม่มีภาพ

### เทรนบน Google Colab

1. เปิด [Google Colab](https://colab.research.google.com/) แล้วอัปโหลด `swu_gesture_training_colab.ipynb`
2. **ตั้ง `UPLOAD_EXISTING_CSV = True`** แล้วเลือก `gestures.csv` ตอนรันเซลล์
3. รันเซลล์ตามลำดับ แล้วนำ `gesture_weights.json` ที่ดาวน์โหลดได้ไปไว้ที่ `web/public/models/`

> ค่าเริ่มต้นของ notebook เทรนด้วยข้อมูลจำลองเพื่อลองขั้นตอนเท่านั้น ความแม่นยำที่ได้ไม่ใช่ผลจริง และห้ามนำโมเดลไปใช้

## แก้ปัญหา

| อาการ | วิธีแก้ |
|---|---|
| `Activate.ps1 cannot be loaded` | รัน `Set-ExecutionPolicy -Scope Process Bypass` แล้ว Activate ใหม่ |
| `ModuleNotFoundError` หรือ `Missing dependencies` | ยังไม่ได้ Activate หรือยังไม่ได้ติดตั้ง ทำตามหัวข้อติดตั้ง |
| `No matching distribution found` ตอนติดตั้ง | ตรวจ `python --version` ว่าเป็น 3.13 |
| `Failed to open video device` | ปิดโปรแกรมที่ใช้กล้องอยู่ เช่น Zoom หรือ Teams และเปิดสิทธิ์กล้องใน Windows Settings |
| `Failed to download hand model` | ตรวจอินเทอร์เน็ต หรือดาวน์โหลดไฟล์จาก URL ในข้อความมาวางในโฟลเดอร์นี้ |
| `module 'mediapipe' has no attribute 'solutions'` | โค้ดเก่าใช้ API ที่ถูกถอดออกแล้ว ให้ใช้ `HandLandmarker` แบบในสคริปต์เหล่านี้ |
| ท่ามือไม่ตรง | เว้นระยะให้เห็นมือทั้งข้าง เปิดไฟให้สว่าง และกางนิ้วโป้งออกตอนแบมือ |

## สถานะ

- ✅ `fivepalm_shutter.py` ทดสอบกับกล้องจริงแล้ว
- ⚠️ `gesture_gif_demo.py` ท่า Scooba ขึ้นกับกล้องจริงแล้ว แต่เกณฑ์ `SCARE` ยังไม่ได้วัดเทียบกับการทำตาโตจริง
- ⚠️ `dataset_collector.py` ทดสอบกับภาพจริงผ่านกล้องจำลองเท่านั้น ยังไม่ได้ลองกับกล้องจริง
- ⬜ ยังไม่มี dataset จริงและโมเดลที่ใช้งานได้

เกณฑ์ตรวจท่ามือตั้งจากรูปตัวอย่างของ MediaPipe ถ้าแก้ค่าใน `fivepalm_shutter.py` ต้องแก้ใน `gestureRules.ts` ให้ตรงกันด้วย
