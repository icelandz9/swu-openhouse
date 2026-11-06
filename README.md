# SWU Open House - AI Photo Booth 📸✨
> ระบบตู้ถ่ายภาพอัจฉริยะแบบไร้สัมผัส (Touchless AI Photo Booth) สำหรับงานเปิดบ้าน มศว (SWU Open House)

---

## 🎯 1. Concept & วัตถุประสงค์โครงการ (Why We Build This)

* 🖐️ **Touchless AI Interaction**: ถ่ายภาพด้วยท่าทางมือ (MediaPipe Hand Keypoints 21 จุด บน WebGL 60 FPS) ทันสมัยและถูกสุขอนามัย
* ⚡ **Queue Optimization (<= 30 วิ/คน)**: หน้าตู้ทำหน้าที่ถ่ายภาพเท่านั้น แล้วแสดงเฉพาะ QR Code ขนาดใหญ่ทันที ผู้ใช้นำมือถือมาสแกนไปแต่งสีและเลือกกรอบรูปบนมือถือตัวเอง คิวหน้าตู้จึงไหลลื่นไม่ติดขัด
* 🏷️ **OPH Short Code & Staff QR Recovery**: รหัส `OPH-XXXX` จะแสดงบนหัวเว็บมือถือให้น้องบันทึกไว้ และมีระบบหลังบ้านสตาฟ (`/admin`) ดู Timeline รูปถ่ายล่าสุดเพื่อยิง QR ให้น้องย้อนหลังได้ทันทีหากสแกนไม่ทัน
* 💸 **0 THB Cloud Infrastructure**: ประมวลผลบน Client-side ทั้งหมด + จัดเก็บภาพบน Cloudflare R2 (ฟรีค่า Egress) พร้อมระบบลบภาพอัตโนมัติ 7 วันตามมาตรฐาน PDPA

---

## 🏗️ 2. ภาพรวมสถาปัตยกรรมระบบ (System Architecture)

```mermaid
flowchart TB
    subgraph KioskBooth["🖥️ ตู้ถ่ายภาพหน้างาน (Physical Kiosk Booth)"]
        Cam["📷 กล้อง USB Webcam 1080p"] -->|"WebRTC Video Stream"| Engine["🧠 Google MediaPipe Tasks-Vision<br>(21 Hand Landmarks Model)"]
        Engine -->|"Open Palm Hold 1.5s"| FSM["⚙️ Kiosk Viewfinder & FSM Engine"]
        FSM -->|"Capture Snapshot"| LocalQueue["💾 Local Cache & Sync Queue"]
        FSM -->|"แสดงเฉพาะ QR Code ใหญ่<br>(ไม่แสดงรหัสตัวอักษร)"| Screen["📺 จอแสดงผล Kiosk (16:9 Landscape)"]
    end

    subgraph CloudInfra["☁️ ระบบคลาวด์ (Cloud & Serverless)"]
        LocalQueue -.->|"Background Sync (เมื่อมีเน็ต)"| R2["📦 Cloudflare R2 Object Storage<br>(Egress 0 บาท + PDPA 7 Days Auto-Purge)"]
        NextServer["⚡ Next.js Full-Stack App<br>(Vercel / Cloudflare Pages)"]
    end

    subgraph MobileDevice["📱 มือถือของผู้ร่วมงาน (Mobile Experience)"]
        Screen -->|"สแกน QR Code"| MobileWeb["🌐 Mobile Web App (/p/OPH-XXXX)"]
        MobileWeb -->|"แสดงรหัส OPH-XXXX ที่หัวเว็บ"| UserAction["🎨 แต่งสี 6 พรีเซ็ต + เลือกกรอบ มศว 3 แบบ"]
        UserAction -->|"Export WebP/JPEG"| CameraRoll["📥 บันทึกลง Camera Roll / แชร์ลงโซเชียล"]
    end

    subgraph StaffPortal["🛡️ ระบบหลังบ้านสตาฟ (Staff Back-Office)"]
        StaffPhone["📱 มือถือสตาฟประจำบูท"] -->|"เข้าสู่ระบบด้วย PIN"| AdminDash["📋 แดชบอร์ด /admin (Recent Captures)"]
        AdminDash -.->|"น้องสแกนไม่ทัน: ดึงรูปตามเวลายิง QR ใหม่อีกครั้ง"| MobileWeb
    end
```

---

## 🔄 3. แผนผังการทำงานตั้งแต่เริ่มถ่ายจนได้รูป (End-to-End Workflow)

```mermaid
flowchart TD
    A(["🚶 น้องเดินเข้าหน้าตู้ถ่ายรูป"]) --> B["📷 ยืนหน้ากล้องและแบมือ 5 นิ้ว (Open Palm) ค้าง 1.5 วินาที"]
    B --> C["⏱️ ตู้นับถอยหลัง 3.. 2.. 1.. และแชะ! บันทึกภาพ"]
    C --> D{"👀 ตรวจสอบภาพพรีวิว (8 วินาที)"}
    
    D -->|"กดปุ่ม ถ่ายใหม่ (จำกัด 1 ครั้ง)"| B
    D -->|"ไม่กด หรือหมดเวลา 8 วินาที"| E["📱 หน้าตู้แสดงเฉพาะ QR Code ขนาดใหญ่<br>(นับถอยหลัง 15-20 วินาที + ปุ่ม 'คนถัดไป')"]

    E --> F{"📲 น้องดำเนินการอย่างไร"}
    F -->|"สแกน QR ทันที"| G["📱 เปิดหน้าเว็บ /p/OPH-XXXX บนมือถือ"]
    F -->|"สแกนไม่ทัน หรือลืมสแกน"| H["🙋 เดินไปหาพี่สตาฟที่บูท"]
    F -->|"กดปุ่ม 'คนถัดไป'"| NextPerson(["✅ ตู้พร้อมสำหรับคิวถัดไปทันที (ใช้เวลา ~30 วินาที)"])

    H --> I["👨‍💼 สตาฟเปิดหน้า /admin เลื่อนดูแกลเลอรีรูปตามเวลา"]
    I --> J["✨ สตาฟแตะรูปเพื่อเปิด QR Code ให้น้องสแกน"]
    J --> G

    subgraph MobileCustomization["🎨 ขั้นตอนทำบนมือถือน้อง (ไม่ขวางคิวตู้)"]
        G --> M1["🏷️ เห็นรหัส OPH-XXXX ที่หัวเว็บ (จดหรือแคปเก็บไว้ดึงรูปย้อนหลัง 7 วัน)"]
        M1 --> M2["🎨 แต่งสีภาพ: เลือก 1 ใน 6 พรีเซ็ต หรือปรับ Brightness"]
        M2 --> M3["🖼️ เลือกกรอบรูป มศว: สลับเลือก 1 ใน 3 กรอบอัตลักษณ์"]
        M3 --> M4["💾 กดปุ่มบันทึกรูปลง Camera Roll พร้อมแชร์ IG / TikTok"]
    end

    M4 --> End(["🎉 เสร็จสิ้นกระบวนการ"])
```

---

## 💻 4. ข้อมูลทางเทคนิคหลัก (Key Tech Stack)

| ส่วนประกอบ (Component) | เทคโนโลยีที่เลือกใช้ (Technology Stack) | เหตุผลและจุดเด่น (Key Rationale) |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 14+ (App Router, TypeScript)** | พัฒนาแบบ Monorepo รองรับทั้งหน้าตู้ Kiosk, มือถือ และระบบสตาฟ |
| **Computer Vision Engine** | **Google MediaPipe Tasks-Vision** | ตรวจจับพิกัดมือ 21 จุด บน WebGL แบบเรียลไทม์ 60 FPS บน Client 100% |
| **Object Storage** | **Cloudflare R2 (S3-Compatible)** | Egress Bandwidth 0 บาท พร้อม Lifecycle Rule ลบภาพทิ้งอัตโนมัติ 7 วัน (PDPA) |
| **Client Compositor** | **HTML5 Canvas 2D API** | ซ้อนเลเยอร์ภาพถ่าย ฟิลเตอร์สี และกรอบ PNG ความละเอียดสูงบนเครื่องผู้ใช้ |
| **Staff Back-Office** | **Next.js Server Actions + PIN Protection** | สตาฟเข้าจัดการตู้และออก QR ย้อนหลังได้สะดวกรวดเร็วจากมือถือ |

---

## 📂 5. สารบัญเอกสารโครงการ (Documentation Index)

เอกสารฉบับเต็มและมาตรฐานทางวิศวกรรมทั้งหมดถูกจัดเก็บอยู่ในโฟลเดอร์ `ducument-sathit/`:

* 📁 **[ducument-sathit/TASK_BACKLOG.md](ducument-sathit/TASK_BACKLOG.md)**: แผนผังความคืบหน้าภาพรวม 12 Tasks ของโครงการ
* 📁 **[ducument-sathit/task00/](ducument-sathit/task00/)**: เอกสารการค้นพบความต้องการ, ผลทดสอบ PoC 4/4 และสถาปัตยกรรมต้นทุน 0 บาท
* 📁 **[ducument-sathit/task01/](ducument-sathit/task01/)**: เอกสารข้อกำหนดความต้องการ (BRD, PRD, SRS/IEEE 830, NFR, RTM) และสถาปัตยกรรมระบบ C4 Model + 6 Sequence Diagrams
