# ภาพรวมระบบและขั้นตอนการทำงาน (System Overview)

ภาพรวมสถาปัตยกรรมระบบ **SWU Open House AI Photo Booth** ฉบับอัปเดตตามการออกแบบหน้างานจริง (1 Laptop + 2 จอแสดงผลภายนอก) — รายละเอียดเชิงลึกดูที่ [สารบัญเอกสาร](README.md) และ [มติล่าสุด](decisions.md)

---

## 1. ผังฮาร์ดแวร์และสถาปัตยกรรมระบบ (Hardware & System Topology)

ระบบทำงานบน **Laptop 1 เครื่อง** ทำหน้าที่เป็นทั้งเซิร์ฟเวอร์หลักและส่งสัญญาณภาพออกไปยังหน้าจอภายนอก 2 จอ (Windows Extended Desktop):

```mermaid
flowchart TB
    subgraph Host["เครื่อง Laptop กลาง (Master Controller & Local Host)"]
        LocalServer["Next.js 15 Server (localhost:3000)<br>+ Local File Storage (web/data/photos/)"]
        LaptopScreen["จอ Laptop: แดชบอร์ดสตาฟ (/admin)<br>- มอนิเตอร์สถานะระบบ (กล้อง, เน็ต, ฮาร์ดแวร์)<br>- ค้นหาภาพและ Re-issue QR ให้น้องที่ทำโค้ดหาย<br>- จัดการระบบด้วย Staff PIN (ไม่มีปุ่มแทรกแซงการถ่าย)"]
    end

    subgraph Display1["จอที่ 1: ตู้ถ่ายภาพไร้สัมผัส (/kiosk)"]
        Webcam["กล้อง USB Webcam 1080p"] -->|"WebRTC Video Stream"| VisionEngine["Google MediaPipe Tasks-Vision<br>(ตรวจจับมือ 21 จุด 60 FPS)"]
        VisionEngine -->|"แบมือ 1.5s เริ่มถ่าย"| KioskFSM["Kiosk FSM Engine (จอ 16:9 ไกด์ 4:3)<br>- นับถอยหลัง 3..2..1..<br>- แฟลชจอขาว 150ms<br>- พรีวิว 10 วินาที<br>(✊ กำมือ = ถ่ายใหม่ / 🖐️ แบมือ = ยืนยัน)"]
    end

    subgraph Display2["จอที่ 2: Showcase & QR Display (/display - สัดส่วน 30/70)"]
        Left30["ฝั่งซ้าย (30%): QR Code Station<br>- แสดง QR Code ขนาดใหญ่ของคนล่าสุด<br>- แสดงรหัส OPH-XXXX ชัดเจน<br>- สตาฟคอยจัดคิวให้น้องสแกนก่อนเริ่มคนถัดไป"]
        Right70["ฝั่งขวา (70%): Live Photo Wall<br>- รวมภาพถ่ายทั้งหมดของน้องๆ ในงาน<br>- แสดงภาพดิบ 4:3 เพียวๆ (ไม่ใส่กรอบ)<br>- วนเวียนรูปภาพล่าสุด 30–50 ภาพ"]
    end

    subgraph MobileDevice["มือถือของผู้ร่วมงาน (เครื่องน้อง: /p/[code])"]
        MobileWeb["Mobile Web Editor (/p/OPH-XXXX)"] -->|"Canvas 2D Engine บนมือถือ"| MobileEdit["แต่งสี 6 พรีเซ็ต + ปรับความสว่าง ±30%<br>+ เลือกกรอบอัตลักษณ์ CPE SWU 3 แบบ (4:3)"]
        MobileEdit -->|"Save Image"| CameraRoll["บันทึกลง Camera Roll / แชร์ลงโซเชียล"]
    end

    KioskFSM -->|"BroadcastChannel (swu_photobooth_bus)"| Left30
    KioskFSM -->|"BroadcastChannel (swu_photobooth_bus)"| Right70
    KioskFSM -->|"บันทึกรูปเข้าเครื่อง"| LocalServer
    Left30 -.->|"น้องใช้มือถือสแกน QR"| MobileWeb
    LaptopScreen -.->|"สตาฟออก QR ย้อนหลังให้น้องที่ทำโค้ดหาย"| Left30
```

---

## 2. ขั้นตอนการทำงานหน้างาน (End-to-End Workflow)

```mermaid
flowchart TD
    A(["น้องเดินเข้าประจำตำแหน่งหน้าจอที่ 1"]) --> B["ยืนหน้ากล้องและแบมือ 5 นิ้ว (Open Palm) ค้าง 1.5 วินาที"]
    B --> C["ตู้นับถอยหลัง 3..2..1.. แล้วแชะ (แฟลชจอขาว 150ms)<br>ตัดภาพตรงกลางสัดส่วน 4:3 (1440x1080 px)"]
    C --> D{"หน้าจอที่ 1 แสดงพรีวิวภาพ 10 วินาที"}
    
    D -->|"น้องกำมือ (Fist ✊)"| D_Retake["ระบบสั่งถ่ายใหม่ทันที (จำกัด 1 ครั้ง)"] --> C
    D -->|"น้องแบมือ (Palm 🖐️) หรือครบ 10 วินาที"| E["ระบบบันทึกรูปภาพและสร้างรหัส OPH-XXXX ทันที"]

    E --> F["จอที่ 1 ส่งข้อมูลข้ามไปจอที่ 2 ผ่าน BroadcastChannel<br>และจอที่ 1 รีเซ็ตกลับ Standby พร้อมรับคนถัดไปทันที"]
    
    F --> G["จอที่ 2 ฝั่งซ้าย (30%) แสดง QR Code ของน้องคนล่าสุด<br>จอที่ 2 ฝั่งขวา (70%) นำภาพดิบ 4:3 ขึ้น Live Photo Wall"]

    G --> H{"น้องสแกน QR Code ที่จอที่ 2"}
    H -->|"สแกนเรียบร้อย"| I["เปิดหน้าแต่งรูป /p/OPH-XXXX บนมือถือของตัวเอง"]
    H -->|"มีปัญหา / ทำโค้ดหาย"| J["ติดต่อพี่สตาฟที่นั่งคุมหน้าจอ Laptop"]
    
    J --> K["สตาฟค้นหารูปในแดชบอร์ด /admin แล้ว Re-issue QR ให้น้องสแกน"]
    K --> I

    subgraph MobileStep["ขั้นตอนทำบนมือถือน้อง (ไม่ขวางคิวถ่ายรูปหน้าตู้)"]
        I --> M1["เห็นรหัส OPH-XXXX ที่หัวเว็บ (ใช้ค้นหาย้อนหลังได้ 7 วัน)"]
        M1 --> M2["แต่งฟิลเตอร์สี: เลือก 1 ใน 6 พรีเซ็ต หรือปรับความสว่าง"]
        M2 --> M3["เลือกกรอบรูป CPE SWU 3 แบบ (Official, Tech Graphic, Photostrip)"]
        M3 --> M4["กดปุ่มบันทึกรูปลงเครื่องมือถือ พร้อมแชร์ IG / Facebook / TikTok"]
    end

    M4 --> End(["เสร็จสิ้นกระบวนการ"])
```

---

## 3. เอกสารอ้างอิงที่เกี่ยวข้อง
- [สารบัญเอกสารโครงการทั้งหมด](README.md)
- [มติล่าสุดของระบบ (Current Decisions)](decisions.md)
- [สถาปัตยกรรมระบบและการออกแบบเชิงเทคนิค (Task 02)](task02-architecture/system-architecture-and-technical-design.md)
- [แผนการแบ่งงาน 3 คนและ Git Workflow](task02-architecture/team-execution-and-github-plan.md)
- [คู่มือสถาปัตยกรรม 4-Layer Pragmatic Clean Architecture](task02-architecture/project-structure-and-clean-architecture-guide.md)
