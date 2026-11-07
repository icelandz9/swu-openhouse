# ภาพรวมระบบและขั้นตอนการทำงาน (System Overview)

ภาพรวมระดับสูงของ SWU Open House AI Photo Booth — รายละเอียดเชิงลึกดูที่ [สารบัญเอกสาร](README.md)

## ภาพรวมระบบ (System Architecture)

```mermaid
flowchart TB
    subgraph KioskBooth["ตู้ถ่ายภาพหน้างาน (Physical Kiosk Booth)"]
        Cam["กล้อง USB Webcam 1080p"] -->|"WebRTC Video Stream"| Engine["Google MediaPipe Tasks-Vision<br>(21 Hand Landmarks Model)"]
        Engine -->|"Open Palm Hold 1.5s"| FSM["Kiosk Viewfinder & FSM Engine"]
        FSM -->|"Capture Snapshot"| LocalQueue["Local Cache & Sync Queue"]
        FSM -->|"แสดงเฉพาะ QR Code ใหญ่<br>(ไม่แสดงรหัสตัวอักษร)"| Screen["จอแสดงผล Kiosk (16:9 Landscape)"]
    end

    subgraph CloudInfra["ระบบคลาวด์ (Cloud & Serverless)"]
        LocalQueue -.->|"Background Sync (เมื่อมีเน็ต)"| R2["Cloudflare R2 Object Storage<br>(Egress 0 บาท + PDPA 7 Days Auto-Purge)"]
        NextServer["Next.js Full-Stack App<br>(Vercel / Cloudflare Pages)"]
    end

    subgraph MobileDevice["มือถือของผู้ร่วมงาน (Mobile Experience)"]
        Screen -->|"สแกน QR Code"| MobileWeb["Mobile Web App (/p/OPH-XXXX)"]
        MobileWeb -->|"แสดงรหัส OPH-XXXX ที่หัวเว็บ"| UserAction["แต่งสี 6 พรีเซ็ต + เลือกกรอบ CPE SWU 3 แบบ"]
        UserAction -->|"Export WebP/JPEG"| CameraRoll["บันทึกลง Camera Roll / แชร์ลงโซเชียล"]
    end

    subgraph StaffPortal["ระบบหลังบ้านสตาฟ (Staff Back-Office)"]
        StaffPhone["มือถือสตาฟประจำบูท"] -->|"เข้าสู่ระบบด้วย PIN"| AdminDash["แดชบอร์ด /admin (Recent Captures)"]
        AdminDash -.->|"น้องสแกนไม่ทัน: ดึงรูปตามเวลายิง QR ใหม่อีกครั้ง"| MobileWeb
    end
```

## ขั้นตอนการทำงาน (Workflow)

```mermaid
flowchart TD
    A(["น้องเดินเข้าหน้าตู้ถ่ายรูป"]) --> B["ยืนหน้ากล้องและแบมือ 5 นิ้ว (Open Palm) ค้าง 1.5 วินาที"]
    B --> C["ตู้นับถอยหลัง 5 วินาที (เปลี่ยนท่าโพสได้) แล้วแชะ<br>ตัดภาพ 4:3"]
    C --> D{"ตรวจสอบภาพพรีวิว (8 วินาที)"}
    
    D -->|"กดปุ่ม ถ่ายใหม่ (จำกัด 1 ครั้ง)"| C
    D -->|"ไม่กด หรือหมดเวลา 8 วินาที"| E["บันทึกรูปลงเครื่องตู้ (อัปโหลดเบื้องหลัง)<br>หน้าตู้แสดงเฉพาะ QR Code ขนาดใหญ่<br>(นับถอยหลัง 15-20 วินาที + ปุ่ม คนถัดไป)"]

    E --> F{"น้องดำเนินการอย่างไร"}
    F -->|"สแกน QR ทันที"| G["เปิดหน้าเว็บ /p/OPH-XXXX บนมือถือ"]
    F -->|"สแกนไม่ทัน หรือลืมสแกน"| H["เดินไปหาพี่สตาฟที่บูท"]
    F -->|"กดปุ่ม คนถัดไป"| NextPerson(["ตู้พร้อมสำหรับคิวถัดไปทันที (ใช้เวลา ~30 วินาที)"])

    H --> I["สตาฟเปิดหน้า /admin เลื่อนดูแกลเลอรีรูปตามเวลา"]
    I --> J["สตาฟแตะรูปเพื่อเปิด QR Code ให้น้องสแกน"]
    J --> G

    subgraph MobileCustomization["ขั้นตอนทำบนมือถือน้อง (ไม่ขวางคิวตู้)"]
        G --> M1["เห็นรหัส OPH-XXXX ที่หัวเว็บ (จดหรือแคปเก็บไว้ดึงรูปย้อนหลัง 7 วัน)"]
        M1 --> M2["แต่งสีภาพ: เลือก 1 ใน 6 พรีเซ็ต หรือปรับ Brightness"]
        M2 --> M3["เลือกกรอบรูป CPE SWU: สลับเลือก 1 ใน 3 กรอบอัตลักษณ์"]
        M3 --> M4["กดปุ่มบันทึกรูปลง Camera Roll พร้อมแชร์ IG / TikTok"]
    end

    M4 --> End(["เสร็จสิ้นกระบวนการ"])
```

## เอกสารที่เกี่ยวข้อง

- [สารบัญเอกสารทั้งหมด](README.md)
- [มติล่าสุดและบันทึกการแก้ไข](decisions.md)
