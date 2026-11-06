# สถาปัตยกรรมระบบ แผนผังเส้นทางผู้ใช้ และลำดับการทำงาน (System Architecture, User Flow & Sequence Diagrams)
## ระบบ AI Photo Booth สำหรับงานเปิดบ้าน มศว (SWU Open House)
**โครงการ**: SWU Open House - Pure AI Photo Booth System  
**เวอร์ชัน**: 2.0 (Approved via `/grill-me` - 100% Photo Booth Core Architecture)  
**วันที่**: 7 พฤศจิกายน 2026  
**มาตรฐานอ้างอิง**:
- **IEEE 1016-2009** (Standard for Information Technology - Systems Design - Software Design Descriptions)
- **C4 Model** (Context, Container, Component, Code)
- **UML 2.5** (Unified Modeling Language - Activity & Sequence Diagrams)

---

## 📌 บทนำและขอบเขตสถาปัตยกรรม (Architectural Scope)
สถาปัตยกรรมนี้มุ่งเน้น **ระบบ AI Photo Booth อย่างเป็นรูปธรรม 100%** (ตัดส่วนงานลงทะเบียน/เกียรติบัตรที่ไม่เกี่ยวข้องออกทั้งหมดตามมติ `/grill-me`) โดยกำหนดโครงสร้างฮาร์ดแวร์ ซอฟต์แวร์ และกระบวนการทำงานของผู้ใช้ 3 กลุ่มหลัก:
1. **ผู้ร่วมงาน / นักเรียน / ผู้ปกครอง (Visitors)**: ถ่ายภาพด้วยท่ามือ ➜ สแกน QR ➜ แต่งสีภาพ ➜ เลือก 1 ใน 3 กรอบ ➜ เซฟรูป
2. **เจ้าหน้าที่สตาฟประจำบูท (Staff Operators)**: ควบคุมตู้, ปลดล็อก Staff Modal ด้วย PIN, แก้ปัญหาเฉพาะหน้า และดูแลการซิงค์
3. **ผู้ดูแลระบบ (System Admin)**: บริหารจัดการ Cloud Storage, กฎหมาย PDPA และวงจรอายุภาพถ่าย 7 วัน

---

## ส่วนที่ 1: แผนผังโครงสร้างระบบภาพรวม (High-Level Architecture - C4 Context & Container)

### 1.1 C4 Context Diagram (บริบทของระบบ Photo Booth)

```mermaid
flowchart TD
    subgraph Actors["กลุ่มผู้ใช้งาน (Actors)"]
        V["นักเรียนมัธยม / ผู้ปกครอง<br>[Visitor]"]
        S["เจ้าหน้าที่สตาฟประจำบูท<br>[Staff Operator]"]
        A["ผู้ดูแลระบบคลาวด์<br>[System Admin]"]
    end

    subgraph PhotoBoothSystem["ระบบ SWU AI Photo Booth System (Next.js Monorepo)"]
        Kiosk["หน้าจอถ่ายภาพตู้ Kiosk<br>(/booth - 16:9 Landscape)"]
        Mobile["เว็บแอปแต่งภาพบนมือถือ<br>(/p/[code], /find)"]
        AdminPortal["แดชบอร์ดสตาฟบนมือถือ<br>(/admin - PIN Protected)"]
        API["Serverless API Routes<br>(/api/upload, /api/photo, /api/admin)"]
    end

    subgraph HardwareLayer["ฮาร์ดแวร์หน้าตู้ (Onsite Hardware)"]
        Webcam["USB Webcam 1080p<br>(Logitech C920/C922)"]
        Screen["มอนิเตอร์ 16:9 แนวนอน<br>(Chrome Kiosk Mode)"]
    end

    subgraph CloudLayer["ระบบคลาวด์และพื้นที่จัดเก็บ (Cloud Infrastructure)"]
        R2["Cloudflare R2 Storage<br>(S3-Compatible, Egress Free)<br>[TTL 7 Days Auto-Purge]"]
        VercelEdge["Vercel Edge Network<br>(Global CDN, HTTPS & SSL)"]
        KV["Cloudflare KV / Supabase<br>(Short Code Map: SWU-XXXX)"]
    end

    V -->|1. ยืนระยะ 1.5 ม. แบมือ 5 นิ้ว| Webcam
    Webcam -->|สตรีม WebRTC 1080p| Kiosk
    Kiosk -->|แสดง Viewfinder & QR Code| Screen
    V -->|2. สแกน QR Code ด้วยมือถือ| Mobile

    Mobile -->|ดึงรูปภาพต้นฉบับ 1080p| R2
    Mobile -->|ประมวลผล Canvas บนมือถือ| Mobile

    S -->|แตะโลโก้ 5 ครั้ง + ใส่ PIN| Kiosk
    S -->|เข้าผ่าน Wi-Fi บูท| AdminPortal
    AdminPortal -->|สั่งรีเซ็ต / ดูสถิติ| API

    A -->|ตรวจสอบความปลอดภัย & PDPA| R2
    A -->|Audit Log| KV

    Kiosk -->|อัปโหลดรูปภาพผ่าน Pre-signed URL| API
    API -->|บันทึกไฟล์ภาพต้นฉบับ| R2
    API -->|แมป Short Code 6 หลัก| KV
    VercelEdge -->|เสิร์ฟ Static Assets & Web App| Kiosk
    VercelEdge -->|เสิร์ฟ Web App บนมือถือ| Mobile
```

### 1.2 C4 Container Diagram (Frontend, Backend, Cache, Storage & CDN)

```mermaid
flowchart LR
    subgraph ClientContainers["ฝั่งผู้ใช้งาน (Client Applications)"]
        subgraph KioskApp["Kiosk Web Application (/booth)"]
            K_UI["React Viewfinder UI<br>(TailwindCSS + Framer Motion)"]
            K_AI["MediaPipe Hand Landmarker<br>(WebGL Tasks-Vision 60 FPS)"]
            K_FSM["Kiosk Finite State Machine<br>(Idle -> Detect -> Count -> QR)"]
            K_Cache["Local Buffer (IndexedDB)<br>(Offline Resilience Queue)"]
        end

        subgraph MobileApp["Mobile Web Application (/p/[code])"]
            M_UI["Mobile Step-by-Step UI<br>(Step 1: Color -> Step 2: Frame)"]
            M_Canvas["HTML5 Canvas 2D Engine<br>(Color Presets + Brightness + PNG Frames)"]
            M_Exporter["Blob & File Exporter<br>(Camera Roll Saver)"]
        end
    end

    subgraph ServerContainers["ฝั่งเซิร์ฟเวอร์ (Serverless Architecture)"]
        subgraph NextServer["Next.js Route Handlers"]
            UploadHandler["/api/upload<br>(Multipart Form Streamer)"]
            PhotoHandler["/api/photo/[code]<br>(Metadata Resolver)"]
            AdminHandler["/api/admin/*<br>(PIN Auth Guard & Stats)"]
        end
    end

    subgraph DataContainers["ฝั่งจัดเก็บข้อมูล (Data & Storage)"]
        R2Bucket["Cloudflare R2 Object Storage<br>/photos/original/SWU-XXXX.jpg<br>(Retention: 7 Days)"]
        KVStore["Metadata & Short Code Store<br>SWU-XXXX -> {createdAt, status}"]
        EdgeCDN["Vercel Edge / Cloudflare CDN<br>(Caching & Asset Delivery)"]
    end

    K_UI --> K_AI
    K_AI --> K_FSM
    K_FSM --> K_Cache
    K_Cache -.->|Async Background Upload| UploadHandler

    UploadHandler --> R2Bucket
    UploadHandler --> KVStore

    M_UI --> M_Canvas
    M_Canvas --> M_Exporter
    M_UI --> PhotoHandler
    PhotoHandler --> KVStore
    PhotoHandler --> R2Bucket

    EdgeCDN --> K_UI
    EdgeCDN --> M_UI
```

---

## ส่วนที่ 2: สถาปัตยกรรมเชิงลึก (Low-Level Architecture: State Machine & Component Tree)

### 2.1 State Machine ของตู้ถ่ายภาพ (Kiosk Finite State Machine - FSM)
ตู้ทำงานแบบ Stateless & Resilient แยกจากมือถือโดยสิ้นเชิง:

```mermaid
stateDiagram-v2
    [*] --> IDLE : เริ่มต้นระบบ / รีเซ็ต

    IDLE --> DETECTING_HAND : กล้องตรวจพบมือขวา/ซ้าย
    DETECTING_HAND --> IDLE : มือหลุดเฟรม / ไม่ครบ 1.5 วินาที
    DETECTING_HAND --> COUNTDOWN : แบมือ 5 นิ้วค้างต่อเนื่องครบ 1.5 วินาที
    IDLE --> COUNTDOWN : ผู้ใช้แตะปุ่ม "แตะเพื่อถ่าย (Touch Fallback)"

    COUNTDOWN --> FLASH_CAPTURE : นับถอยหลัง 3.. 2.. 1.. ถึงศูนย์
    FLASH_CAPTURE --> PREVIEW_RETAKE : บันทึกภาพ 1080p + แสดงจอขาว Flash 100ms

    PREVIEW_RETAKE --> COUNTDOWN : ผู้ใช้กด "ถ่ายใหม่ (Retake)" [จำกัด 1 ครั้ง]
    PREVIEW_RETAKE --> QR_DISPLAY : ผู้ใช้กด "ยืนยัน" หรือ ปล่อยเวลานับถอยหลัง 8 วินาทีหมดลง

    QR_DISPLAY --> IDLE : ผู้ใช้กดปุ่ม "เสร็จสิ้น / คนถัดไป (Done)" หรือ หมดเวลา 15-20 วินาที
    
    state STAFF_OVERRIDE {
        [*] --> STAFF_MENU : แตะโลโก้ 5 ครั้ง + ใส่ PIN ถูกต้อง
        STAFF_MENU --> IDLE : สั่งรีเซ็ตตู้ / บังคับคืนสถานะ
    }

    IDLE --> STAFF_OVERRIDE : แตะโลโก้ 5 ครั้ง
    QR_DISPLAY --> STAFF_OVERRIDE : แตะโลโก้ 5 ครั้ง
    PREVIEW_RETAKE --> STAFF_OVERRIDE : แตะโลโก้ 5 ครั้ง
```

---

## ส่วนที่ 3: แผนผังเส้นทางการใช้งานของผู้ใช้แต่ละกลุ่ม (User Flow Diagrams)

### 3.1 Visitor Flow: เส้นทางการถ่ายรูปและดาวน์โหลดของนักเรียน/ผู้ปกครอง

```mermaid
flowchart TD
    Start(["เดินเข้าสู่บูท Photo Booth"]) --> Front["ยืนหน้ากล้อง 1080p ในระยะ 1.5 เมตร"]
    Front --> ChooseTrigger{"เลือกวิธีสั่งถ่ายภาพ"}
    
    ChooseTrigger -->|"วิธีที่ 1 ท่าหลัก"| PalmPose["แบมือ 5 นิ้ว Open Palm เข้าหากล้อง"]
    ChooseTrigger -->|"วิธีที่ 2 แตะจอสำรอง"| TouchTap["แตะปุ่ม แตะเพื่อถ่าย บนหน้าจอ"]

    PalmPose --> HoldCheck{"ทำท่ามือค้างต่อเนื่อง ครบ 1.5 วินาทีหรือไม่"}
    HoldCheck -->|"คนเดินผ่าน หรือชักมือกลับ"| ResetIdle["ยกเลิกการนับ กลับสู่หน้าพร้อมถ่าย Idle"]
    ResetIdle --> Front
    HoldCheck -->|"ครบ 1.5 วินาที"| StartTimer["เริ่มนับถอยหลัง 3.. 2.. 1.. พร้อมเสียง Beep"]
    TouchTap --> StartTimer

    StartTimer --> Flash["แชะ หน้าจอกะพริบขาว 100ms และบันทึกภาพ"]
    Flash --> Preview["แสดงภาพพรีวิวทันที และปุ่มถ่ายใหม่ นับถอยหลัง 8 วิ"]

    Preview --> RetakeCheck{"ต้องการถ่ายใหม่หรือไม่"}
    RetakeCheck -->|"กดถ่ายใหม่ สิทธิ์ 1 ครั้ง"| StartTimer
    RetakeCheck -->|"ไม่กด หรือปล่อยเวลาหมด 8 วิ"| GenQR["สร้าง Short Code SWU-XXXX และแสดง QR Code"]

    GenQR --> ShowQRScreen["หน้าจอแสดง QR Code ขนาดใหญ่ และรหัส SWU-XXXX นับถอยหลัง 15-20 วิ และปุ่มคนถัดไป"]

    ShowQRScreen --> VisitorAction{"ผู้ใช้งานดำเนินการอย่างไร"}
    VisitorAction -->|"สแกนด้วยมือถือทันที"| ScanQR["เปิดเว็บเบราว์เซอร์บนมือถือ /p/SWU-XXXX"]
    VisitorAction -->|"ถ่ายรูปหน้าจอเก็บไว้"| SnapCode["ถ่ายรูปหน้าจอที่มีรหัส SWU-XXXX ไว้"]
    VisitorAction -->|"กดปุ่ม คนถัดไป"| DoneKiosk["ตู้พร้อมให้บริการคิวถัดไปทันที ใช้เวลาหน้าตู้ประมาณ 30 วิ"]

    SnapCode --> LaterVisit["กลับบ้านเปิดเว็บ /find ภายใน 7 วัน แล้วกรอกรหัส"]
    LaterVisit --> ScanQR

    subgraph MobileExperience["ขั้นตอนแต่งภาพบนมือถือของผู้ใช้"]
        ScanQR --> Step1["ขั้นตอนที่ 1 แต่งสี แตะเลือก 1 ใน 6 พรีเซ็ต หรือปรับ Brightness Slider"]
        Step1 --> Step2["ขั้นตอนที่ 2 เลือกกรอบ สลับเลือก 1 ใน 3 กรอบรูป มศว"]
        Step2 --> Step3["ขั้นตอนที่ 3 ดาวน์โหลด กดปุ่ม บันทึกรูปภาพ ลง Camera Roll"]
        Step3 --> Share["แชร์ลง Instagram Story หรือ TikTok ทันที"]
    end

    Share --> End(["จบกิจกรรมอย่างประทับใจ"])
```

### 3.2 Staff Flow: เส้นทางการปฏิบัติงานและการควบคุมของสตาฟประจำบูท

```mermaid
flowchart TD
    StaffStart(["สตาฟประจำบูทเข้าควบคุมตู้"]) --> ChooseMethod{"เลือกช่องทางจัดการ"}

    ChooseMethod -->|หน้าจอตู้ Kiosk| TapLogo["แตะโลโก้ มศว มุมซ้ายบน 5 ครั้งติดกัน<br>(หรือกดปุ่ม Ctrl+Shift+A)"]
    ChooseMethod -->|มือถือสตาฟ| OpenPhone["เปิดเว็บ https://<domain>/admin ผ่าน Wi-Fi บูท"]

    TapLogo --> PromptPIN["กรอกรหัส Staff PIN 4-6 หลัก"]
    OpenPhone --> PromptPIN

    PromptPIN --> CheckPIN{"ตรวจสอบรหัส PIN"}
    CheckPIN -->|ผิดเกิน 5 ครั้ง| Lockout["ล็อกหน้าจอชั่วคราว 60 วินาที (Brute-force Guard)"]
    CheckPIN -->|ถูกต้อง| Panel["เข้าสู่ Staff Control Panel"]

    Panel --> SelectCommand{"เลือกคำสั่งควบคุม"}
    SelectCommand --> CmdReset["1. สั่งรีเซ็ตตู้กลับสู่หน้าแรกทันที (Clear Stuck Session)"]
    SelectCommand --> CmdCam["2. สลับอุปกรณ์กล้อง Webcam หรือ Calibrate ท่ามือ"]
    SelectCommand --> CmdStats["3. ดูสถิติจำนวนคนถ่าย และตรวจสอบคิวอัปโหลด"]
    SelectCommand --> CmdSync["4. สั่ง Force Sync อัปโหลดรูปภาพที่ค้างในเครื่องตู้"]

    CmdReset --> StaffDone(["เสร็จสิ้นคำสั่ง ตู้พร้อมใช้งานต่อ"])
    CmdCam --> StaffDone
    CmdStats --> StaffDone
    CmdSync --> StaffDone
```

### 3.3 Admin Flow: การทำลายข้อมูลอัตโนมัติ 7 วันตามมาตรฐาน PDPA

```mermaid
flowchart TD
    CronStart(["Cron Job ทำงานอัตโนมัติทุกวันเวลา 00:00 น."]) --> Query["ค้นหารูปภาพที่มี CreatedAt เกิน 7 วันในฐานข้อมูล"]
    Query --> CheckExpired{"พบรูปภาพที่หมดอายุหรือไม่?"}

    CheckExpired -->|ไม่พบ| CronEnd(["สิ้นสุดรอบการตรวจสอบ"])
    CheckExpired -->|พบรูปหมดอายุ| DeleteCloud["ลบไฟล์ภาพต้นฉบับใน Cloudflare R2 Bucket"]

    DeleteCloud --> DeleteMeta["ลบรหัส Short Code ออกจาก Metadata Store"]
    DeleteMeta --> WriteLog["บันทึก RoPA Audit Log การลบทำลายข้อมูลตาม PDPA"]
    WriteLog --> CronEnd
```

---

## ส่วนที่ 4: ลำดับการทำงานของกระบวนการสำคัญ (Sequence Diagrams)

### 4.1 Sequence 01: Touchless Hand Gesture Capture & Countdown Loop
กระบวนการตรวจจับท่าทางมือแบบ Real-time:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as ผู้ร่วมงาน (Visitor)
    participant Cam as กล้อง USB Webcam
    participant MP as MediaPipe Hand Landmarker (WebGL)
    participant Debounce as Debounce Controller (1.5s)
    participant UI as Kiosk Viewfinder UI

    Visitor->>Cam: ยืนหน้ากล้อง และยกมือแบ 5 นิ้ว (Open Palm)
    loop ทุกๆ 16ms (60 FPS)
        Cam->>MP: สตรีมเฟรมวิดีโอ 1080p
        MP->>MP: คำนวณพิกัด 21 Hand Landmarks
        MP->>Debounce: ส่งข้อมูลพิกัดมือ + ค่าความลึก z
        Debounce->>Debounce: กรองเฉพาะมือที่ใหญ่และใกล้ที่สุด (Depth Filter)
        Debounce->>Debounce: ตรวจสอบรูปทรงนิ้วมือ (Open Palm Heuristic)
        alt ท่าทางถูกต้องต่อเนื่อง
            Debounce->>Debounce: เพิ่มเวลาสะสม (HoldTime += deltaTime)
            Debounce->>UI: ส่ง Progress วงแหวนนับรอบมือ (0% -> 100%)
        else มือหลุดเฟรม หรือเปลี่ยนท่า
            Debounce->>Debounce: ล้างเวลาสะสม HoldTime = 0
            Debounce->>UI: รีเซ็ต Progress วงแหวนเป็น 0%
        end
    end

    Note over Debounce,UI: เมื่อ HoldTime สะสมครบ 1.5 วินาที
    Debounce->>UI: ส่งสัญญาณ TRIGGER_CAPTURE
    UI->>Visitor: เล่นเสียง Beep + แสดงตัวเลข 3.. 2.. 1.. บนหน้าจอ
    UI->>Cam: สั่ง Freeze Frame ที่วินาทีที่ 0
    UI->>Visitor: แสดงเอฟเฟกต์แฟลชจอขาว (Flash 100ms)
    UI->>UI: เปลี่ยนสถานะเป็น SHOW_PREVIEW
```

### 4.2 Sequence 02: Image Capture, Preview & 5-8s Retake Logic
กระบวนการพรีวิวและการให้โอกาสถ่ายแก้ตัว:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as ผู้ร่วมงาน (Visitor)
    participant UI as Kiosk Viewfinder UI
    participant Buffer as Local Disk Buffer (SSD)
    participant State as Kiosk FSM Controller

    UI->>Buffer: บันทึกภาพต้นฉบับ 1080p ลง Local Buffer ชั่วคราว
    UI->>Visitor: แสดงภาพพรีวิวทันที + ปุ่ม "ถ่ายใหม่" + เวลานับถอยหลัง 8.. 7.. 6..

    alt ผู้ใช้กดปุ่ม "ถ่ายใหม่" (ภายใน 8 วินาที)
        Visitor->>UI: แตะปุ่ม "ถ่ายใหม่"
        UI->>Buffer: ลบภาพเดิมใน Buffer ทิ้ง
        UI->>State: อัปเดตสิทธิ์ RetakeUsed = true
        UI->>Visitor: เริ่มนับถอยหลัง 3.. 2.. 1.. ถ่ายใหม่อีกครั้งทันที
    else ผู้ใช้ไม่กด หรือเวลานับถอยหลังหมดลง (Auto-Confirm)
        UI->>State: สิ้นสุดระยะเวลา Retake (CONFIRM_PHOTO)
        UI->>UI: เปลี่ยนสถานะเป็น GENERATING_QR
    end
```

### 4.3 Sequence 03: Storage Upload, Short Code & QR Generation (พร้อม Offline Fallback)
การออกรหัสสั้นและการประกันความเสถียรกรณีเน็ตหลุด:

```mermaid
sequenceDiagram
    autonumber
    participant UI as Kiosk Viewfinder UI
    participant CodeEngine as Short Code Engine
    participant LocalDB as Local IndexedDB Buffer
    participant SyncWorker as Background Sync Worker
    participant CloudAPI as Cloudflare R2 / Serverless API

    UI->>CodeEngine: ขอรหัสสั้นประจำรูปภาพ
    CodeEngine->>CodeEngine: สุ่มรหัส 4 หลัก (เช่น SWU-8821)
    CodeEngine-->>UI: ส่งคืนรหัส SWU-8821 และ URL: https://booth.swu.ac.th/p/SWU-8821

    UI->>UI: แสดง QR Code ขนาดใหญ่ + รหัส SWU-8821 บนจอทันที (< 200ms)
    UI->>UI: เริ่มนับถอยหลังหน้าจอ 15-20 วินาที + แสดงปุ่ม "เสร็จสิ้น / คนถัดไป"
    UI->>LocalDB: บันทึกภาพต้นฉบับ + Metadata ลงไดรฟ์เครื่องตู้

    Note over LocalDB,CloudAPI: การอัปโหลดทำงานเบื้องหลัง ไม่บล็อกหน้าจอ
    SyncWorker->>LocalDB: ดึงภาพค้างส่งจากคิว
    SyncWorker->>CloudAPI: เรียก POST /api/upload (Multipart Form)

    alt อินเทอร์เน็ตปกติ (200 OK)
        CloudAPI-->>SyncWorker: อัปโหลดเสร็จสมบูรณ์
        SyncWorker->>LocalDB: อัปเดตสถานะเป็น SYNCED
    else อินเทอร์เน็ตในงานขัดข้อง (Network Error)
        CloudAPI--xSyncWorker: การเชื่อมต่อล้มเหลว (Offline)
        SyncWorker->>LocalDB: คงสถานะ PENDING ในเครื่องตู้
        SyncWorker->>SyncWorker: ตั้งเวลา Auto-retry แบบ Exponential Backoff
        Note over UI: หน้าตู้ยังคงให้บริการคนต่อไปได้ตามปกติ รูปไม่สูญหาย!
    end
```

### 4.4 Sequence 04: Mobile Customization (6 Presets + Brightness + 3 Frames + Download)
ขั้นตอนการแต่งภาพบนสมาร์ตโฟนของผู้ใช้งาน:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as ผู้ร่วมงาน (Visitor)
    participant Browser as Mobile Browser (iOS Safari / Chrome)
    participant CDN as Cloudflare Edge CDN / R2
    participant Canvas as HTML5 Canvas 2D Engine
    participant Gallery as Camera Roll / Gallery มือถือ

    Visitor->>Browser: สแกน QR Code เข้าสู่ https://booth.swu.ac.th/p/SWU-8821
    Browser->>CDN: ดึงภาพถ่ายต้นฉบับ 1080p
    CDN-->>Browser: ส่งคืนภาพถ่ายความละเอียดสูง
    Browser->>Canvas: โหลดภาพลงใน Offscreen Canvas

    Note over Visitor,Canvas: ขั้นตอนที่ 1: การแต่งสีภาพ (Color Grading)
    Visitor->>Browser: แตะเลือกฟิลเตอร์พรีเซ็ต (เช่น Rosy Bright) หรือเลื่อนปรับสว่าง
    Browser->>Canvas: คำนวณ Color Transform Matrix
    Canvas-->>Browser: อัปเดตภาพพรีวิวสดแบบเรียลไทม์ (Live Preview < 16ms)
    Visitor->>Browser: กดปุ่ม "ถัดไป: เลือกกรอบรูป"

    Note over Visitor,Canvas: ขั้นตอนที่ 2: การเลือก 1 ใน 3 กรอบรูป มศว
    Browser->>CDN: โหลดไฟล์กรอบรูป PNG โปร่งใสทั้ง 3 แบบ
    Visitor->>Browser: แตะเลือก "Template 01: ลายทางการ มศว สีแดง-ขาว"
    Browser->>Canvas: วาดภาพถ่ายซ้อนใต้เลเยอร์กรอบรูป PNG (Alpha Blending)
    Canvas-->>Browser: แสดงภาพคอมโพสิตที่ผสานเสร็จสมบูรณ์

    Note over Visitor,Gallery: ขั้นตอนที่ 3: การบันทึกภาพลงเครื่อง
    Visitor->>Browser: กดปุ่ม "ดาวน์โหลดรูปภาพ (Save Photo)"
    Canvas->>Canvas: แปลง Canvas เป็น Blob (WebP / JPEG คุณภาพ 0.92)
    Browser->>Gallery: สั่งบันทึกไฟล์ภาพลงใน Camera Roll ของมือถือ
    Browser->>Visitor: แสดงข้อความ "บันทึกภาพสำเร็จ พร้อมแชร์ลง IG Story!"
```

### 4.5 Sequence 05: Retroactive Photo Retrieval (`/find`) & 7-Day Expiry Check
การค้นหาภาพถ่ายย้อนหลังด้วยรหัส 6 หลัก:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as ผู้ร่วมงาน (Visitor)
    participant Web as Web Browser (/find)
    participant API as /api/photo/[code]
    participant KV as Short Code Metadata Store
    participant R2 as Cloudflare R2 Storage

    Visitor->>Web: เข้าเว็บ https://booth.swu.ac.th/find และพิมพ์รหัส "SWU-8821"
    Web->>API: ส่งคำขอ GET /api/photo/SWU-8821
    API->>KV: ค้นหารหัส SWU-8821

    alt รหัสถูกต้องและอายุภาพยังไม่เกิน 7 วัน
        KV-->>API: พบข้อมูล (CreatedAt: 2026-11-07, FilePath: photos/...)
        API-->>Web: ส่งคืนสถานะ 200 OK พร้อม CDN Image URL
        Web->>Visitor: เปิดหน้าจอแต่งภาพ /p/SWU-8821 ให้เลือกกรอบและดาวน์โหลดได้ทันที
    else รหัสไม่ถูกต้อง หรือเกิน 7 วัน (ถูกลบตาม PDPA แล้ว)
        KV-->>API: ไม่พบข้อมูล หรือข้อมูลหมดอายุแล้ว
        API-->>Web: ส่งคืนสถานะ 404 Not Found
        Web->>Visitor: แสดงข้อความแจ้งเตือน "ไม่พบรหัสภาพ หรือภาพถ่ายหมดอายุแล้ว (เกิน 7 วัน)"
    end
```

### 4.6 Sequence 06: Staff PIN Authentication & Remote Kiosk Control
การยืนยันตัวตนและการเข้าควบคุมตู้ของสตาฟ:

```mermaid
sequenceDiagram
    autonumber
    actor Staff as สตาฟประจำบูท
    participant Kiosk as หน้าจอ Kiosk
    participant Modal as Staff PIN Modal
    participant API as /api/admin/*
    participant FSM as Kiosk FSM Engine

    Staff->>Kiosk: แตะโลโก้ มศว 5 ครั้งติดกัน (หรือกด Ctrl+Shift+A)
    Kiosk->>Modal: แสดงหน้าต่างลับกรอกรหัส PIN
    Staff->>Modal: กรอกรหัส PIN "8821"
    Modal->>API: ส่งคำขอตรวจสอบ POST /api/admin/auth { pin: "8821" }

    alt PIN ถูกต้อง
        API-->>Modal: 200 OK (Authorized)
        Modal->>Staff: แสดงแผงเมนูควบคุม (สลับกล้อง, รีเซ็ตตู้, บังคับซิงค์)
        Staff->>Modal: แตะปุ่ม "รีเซ็ตตู้ทันที (Emergency Reset)"
        Modal->>FSM: ส่งคำสั่ง FORCE_RESET
        FSM->>Kiosk: ล้างหน่วยความจำชั่วคราวทั้งหมด และกลับสู่สถานะ IDLE พร้อมรับคิวต่อไป
    else PIN ไม่ถูกต้องเกิน 5 ครั้ง
        API-->>Modal: 429 Too Many Requests (Lockout 60s)
        Modal->>Staff: ล็อกการกรอกรหัส 1 นาทีเพื่อความปลอดภัย
    end
```

---

## ส่วนที่ 5: การจัดการข้อผิดพลาดและข้อยกเว้น (Fault Matrix & Error Handling)

| สถานการณ์ขัดข้อง (Fault Scenario) | ผลกระทบที่เกิดขึ้น | วิธีการตรวจจับและการจัดการ (Detection & Recovery) | การแสดงผลที่ผู้ใช้เห็น |
| :--- | :--- | :--- | :--- |
| **1. กล้อง USB หลุด หรือสายหลวม** | หน้าจอ Viewfinder มืดดำ | ดักจับ WebRTC `track.onended` event | แสดงหน้าจอแจ้งเตือนสีส้ม: *"กล้องขัดข้อง กำลังเชื่อมต่อใหม่..."* พร้อมแจ้งเตือนสตาฟ |
| **2. ผู้ใช้เดินหนีหลังถ่ายเสร็จ** | ตู้ค้างที่หน้าพรีวิว | ตัวนับถอยหลัง Timeout 8 วินาทีในหน้าพรีวิว | หมดเวลา 8 วิ จะข้ามไปแสดง QR Code 15 วินาที แล้วรีเซ็ตกลับหน้าแรกเองโดยอัตโนมัติ |
| **3. สัญญาณ Wi-Fi ในฮอลล์ดับ** | อัปโหลดขึ้น Cloudflare R2 ไม่ได้ | API Fetch โยนข้อผิดพลาด `NetworkError` | สวิตช์เข้าสู่ **Offline Mode**: บันทึกลงไดรฟ์ตู้ โชว์ QR Code ทันที และมี Sync Queue คอยอัปโหลดเมื่อเน็ตมา |
| **4. แสงไฟในบูทมืดเกินไป** | MediaPipe จับข้อมือไม่ติด | Landmark Detection Confidence < 0.6 ติดต่อกัน 3 วินาที | แสดงปุ่มขนาดใหญ่บนหน้าจอ: *"แตะตรงนี้เพื่อถ่ายรูป (Tap to capture)"* เป็นทางเลือกสำรอง |
| **5. สแกน QR ไม่ทันใน 15 วินาที** | หน้าจอตู้รีเซ็ตกลับหน้าแรกแล้ว | สื่อสารให้ผู้ใช้ถ่ายรูปหน้าจอไว้ล่วงหน้า | ผู้ใช้สามารถนำรหัส 6 หลักบนหน้าจอไปกรอกในหน้า `/find` เพื่อโหลดรูปได้ตลอด 7 วัน |
