# สถาปัตยกรรมระบบ แผนผังเส้นทางผู้ใช้ และลำดับการทำงาน (System Architecture, User Flow & Sequence Diagrams)
**โครงการ**: SWU Open House - AI Photo Booth & Event Experience Platform  
**เวอร์ชัน**: 1.0 (Comprehensive Engineering Design)  
**วันที่**: 7 พฤศจิกายน 2026  
**มาตรฐานอ้างอิง**:
- **IEEE 1016-2009** (Standard for Information Technology - Systems Design - Software Design Descriptions)
- **C4 Model** for Visualizing Software Architecture
- **UML 2.5** (Unified Modeling Language - Sequence & Activity Diagrams)

---

## 📑 สารบัญ (Table of Contents)
1. [ส่วนที่ 1: ภาพรวมสถาปัตยกรรมระบบ (High-Level System Architecture - C4 Context & Container)](#ส่วนที่-1-ภาพรวมสถาปัตยกรรมระบบ-high-level-system-architecture)
2. [ส่วนที่ 2: สถาปัตยกรรมเชิงลึก (Low-Level Architecture - Components & Data Flow)](#ส่วนที่-2-สถาปัตยกรรมเชิงลึก-low-level-architecture)
3. [ส่วนที่ 3: แผนผังเส้นทางการใช้งานของผู้ใช้แต่ละกลุ่ม (User Flow Diagrams)](#ส่วนที่-3-แผนผังเส้นทางการใช้งานของผู้ใช้แต่ละกลุ่ม-user-flow-diagrams)
   - 3.1 Flow สำหรับผู้ร่วมงาน / นักเรียน / ผู้ปกครอง (Visitor Flow)
   - 3.2 Flow สำหรับสตาฟประจำบูท (Staff Flow)
   - 3.3 Flow สำหรับผู้ดูแลระบบ (Admin Flow)
4. [ส่วนที่ 4: ลำดับการทำงานของกระบวนการสำคัญ (Sequence Diagrams)](#ส่วนที่-4-ลำดับการทำงานของกระบวนการสำคัญ-sequence-diagrams)
   - 4.1 Sequence 01: Touchless Hand Gesture Capture & Countdown Loop
   - 4.2 Sequence 02: Image Capture, Preview & Retake Logic
   - 4.3 Sequence 03: Storage Upload, Short Code & QR Generation (พร้อม Offline Fallback)
   - 4.4 Sequence 04: Mobile Customization (Color Grading + 3 Frame Templates + Download)
   - 4.5 Sequence 05: Retroactive Photo Retrieval (`/find`) & Open House Verification
   - 4.6 Sequence 06: Staff PIN Authentication & Remote Kiosk Control
5. [ส่วนที่ 5: การจัดการข้อผิดพลาดและข้อยกเว้น (Error Handling & Edge Cases)](#ส่วนที่-5-การจัดการข้อผิดพลาดและข้อยกเว้น-error-handling--edge-cases)

---

## ส่วนที่ 1: ภาพรวมสถาปัตยกรรมระบบ (High-Level System Architecture)

### 1.1 C4 System Context Diagram
แผนผังแสดงบริบทของระบบ ผู้ใช้งานทุกกลุ่ม และการเชื่อมต่อกับระบบภายนอก:

```mermaid
flowchart TD
    subgraph Users["กลุ่มผู้ใช้งาน (Actors)"]
        U1["นักเรียนมัธยม / ผู้ปกครอง<br>(Visitor)"]
        U2["พี่สตาฟประจำบูท<br>(Staff Operator)"]
        U3["ผู้ดูแลระบบ<br>(System Admin)"]
    end

    subgraph SWUSystem["ระบบ SWU Open House AI Photo Booth"]
        KioskApp["ตู้ถ่ายภาพอัจฉริยะ<br>(Kiosk Web App /booth)"]
        MobileApp["เว็บพอร์ทัลมือถือ<br>(Mobile Web Portal /p/[code], /find)"]
        AdminApp["แดชบอร์ดจัดการระบบ<br>(Staff Admin Portal /admin)"]
        BackendAPI["API Serverless Engine<br>(Next.js Route Handlers)"]
    end

    subgraph CloudInfra["โครงสร้างพื้นฐานคลาวด์ (Cloud & Storage)"]
        CloudflareR2["Cloudflare R2<br>(S3-Compatible Object Storage)<br>[TTL 7 Days Auto-Purge]"]
        VercelEdge["Vercel Edge Network<br>(Global CDN & SSL)"]
        MetadataDB["Supabase / KV Store<br>(Session & Code Metadata)"]
    end

    subgraph Hardware["ฮาร์ดแวร์หน้าตู้ (Booth Hardware)"]
        Webcam["USB Webcam 1080p<br>(Logitech Full HD)"]
        Screen["16:9 Landscape Monitor<br>(Full Screen Preview)"]
    end

    U1 -->|1. โพสท่าแบมือ 5 นิ้ว| Webcam
    Webcam -->|WebRTC Video Stream| KioskApp
    KioskApp -->|แสดงภาพพรีวิว & QR Code| Screen
    U1 -->|2. สแกน QR Code ด้วยมือถือ| MobileApp

    MobileApp -->|ดึงรูปภาพต้นฉบับ| CloudflareR2
    MobileApp -->|ส่งคำขอปรับแต่ง/ดาวน์โหลด| BackendAPI

    U2 -->|แตะโลโก้ 5 ครั้ง + ใส่ PIN| KioskApp
    U2 -->|เข้าจัดการผ่านมือถือ /admin| AdminApp
    AdminApp -->|มอนิเตอร์ยอด & สั่งรีเซ็ต| BackendAPI

    U3 -->|จัดการ Lifecycle & Logs| CloudflareR2
    U3 -->|ตรวจสอบความปลอดภัย| MetadataDB

    BackendAPI -->|อัปโหลดรูปภาพพร้อม Pre-signed Key| CloudflareR2
    BackendAPI -->|บันทึกรหัส SWU-XXXX| MetadataDB
    VercelEdge -->|เสิร์ฟเว็บแอพความเร็วสูง| MobileApp
    VercelEdge -->|เสิร์ฟเว็บหน้าตู้| KioskApp
```

### 1.2 C4 Container Diagram
แผนผังโครงสร้าง Container และเทคโนโลยีที่ใช้ในแต่ละส่วน:

```mermaid
flowchart LR
    subgraph ClientLayer["Client Layer (Frontend)"]
        subgraph KioskContainer["Kiosk Client (Next.js App)"]
            UIKiosk["Viewfinder & Touchless UI<br>(React 18 + TailwindCSS)"]
            AIEngine["Google MediaPipe Hand Landmarker<br>(WebGL Tasks-Vision 60 FPS)"]
            LocalQueue["Local Storage / IndexedDB<br>(Offline-first Image Buffer)"]
        end

        subgraph MobileContainer["Mobile Web Client"]
            UIMobile["Mobile Customizer UI<br>(React + Touch Carousel)"]
            CanvasEngine["HTML5 Canvas 2D Engine<br>(Color Grading & Frame Layering)"]
        end
    end

    subgraph ServerLayer["Serverless Backend Layer"]
        subgraph NextServer["Next.js Serverless Environment"]
            UploadAPI["/api/upload<br>(Multipart Form / Stream)"]
            PhotoAPI["/api/photo/[code]<br>(Metadata & CDN Proxy)"]
            HealthAPI["/api/health<br>(Heartbeat & Status)"]
            AdminAPI["/api/admin/*<br>(PIN Auth & Reset Signals)"]
        end
    end

    subgraph StorageLayer["Data & Storage Layer"]
        R2Bucket["Cloudflare R2 Bucket<br>/photos/original/[id].jpg<br>/photos/composite/[code].webp"]
        KVStore["Metadata & Cache Store<br>(Short Code Map: SWU-XXXX)"]
    end

    UIKiosk --> AIEngine
    UIKiosk --> LocalQueue
    LocalQueue -.->|Async Background Sync| UploadAPI
    UploadAPI --> R2Bucket
    UploadAPI --> KVStore

    UIMobile --> CanvasEngine
    UIMobile --> PhotoAPI
    PhotoAPI --> KVStore
    PhotoAPI --> R2Bucket
    AdminAPI --> KVStore
```

---

## ส่วนที่ 2: สถาปัตยกรรมเชิงลึก (Low-Level Architecture & Components)

### 2.1 โครงสร้างคอมโพเนนต์และการจัดเก็บไฟล์ (Next.js Component Tree)

```text
src/
├── app/
│   ├── layout.tsx                 # Root Layout (Fonts, Locale Context)
│   ├── page.tsx                   # Landing Page / Redirection
│   ├── booth/
│   │   └── page.tsx               # Kiosk Viewfinder Screen (Full Screen 16:9)
│   ├── p/
│   │   └── [code]/
│   │       └── page.tsx           # Mobile Customization & Download Screen
│   ├── find/
│   │   └── page.tsx               # Retroactive Short Code Lookup Page
│   ├── admin/
│   │   └── page.tsx               # Staff Mobile Management Dashboard
│   └── api/
│       ├── upload/route.ts        # Image Upload Endpoint (with Pre-signed URLs)
│       ├── photo/[code]/route.ts  # Photo Lookup & CDN URL Resolver
│       └── admin/
│           ├── stats/route.ts     # Real-time Visitor Stats
│           └── reset/route.ts     # Kiosk Reset Signal Dispatcher
├── components/
│   ├── kiosk/
│   │   ├── CameraStream.tsx       # WebRTC getUserMedia Component
│   │   ├── HandLandmarkCanvas.tsx # Visual Hand Skeletal Overlay
│   │   ├── CountdownOverlay.tsx   # 3..2..1.. Timer & White Flash
│   │   ├── RetakeTimerModal.tsx   # 5-8s Preview & Retake Button
│   │   ├── QRCodeDisplay.tsx      # SVG QR Code & Short Code Banner
│   │   └── StaffSecretModal.tsx   # Hidden Trigger PIN Modal
│   ├── mobile/
│   │   ├── ColorFilterSlider.tsx  # 6 Presets + Brightness Adjuster
│   │   ├── FrameSelector.tsx      # 3 Pre-made SWU Frame Selector
│   │   ├── CanvasCompositor.tsx   # High-resolution Layering Canvas
│   │   └── DownloadButton.tsx     # Native Camera Roll Saver
│   └── common/
│       ├── LanguageToggle.tsx     # TH | EN Switcher
│       └── PrivacyNoticeModal.tsx # PDPA Consent Banner
└── lib/
    ├── mediapipe/
    │   └── handLandmarker.ts      # WebGL MediaPipe Hand Detection Engine
    ├── gesture/
    │   ├── classifier.ts          # Open Palm & Multi-pose Keypoint Heuristics
    │   └── debounceController.ts  # 1.5s Hold Duration Filter
    ├── storage/
    │   ├── offlineQueue.ts        # IndexedDB Offline Sync Buffer
    │   └── r2Client.ts            # Cloudflare R2 S3 Client SDK
    └── utils/
        ├── shortCode.ts           # Non-ambiguous 6-char Code Generator
        └── dateExpiry.ts          # PDPA 7-day TTL Date Calculator
```

---

## ส่วนที่ 3: แผนผังเส้นทางการใช้งานของผู้ใช้แต่ละกลุ่ม (User Flow Diagrams)

### 3.1 User Flow สำหรับผู้ร่วมงาน (Visitor Journey)
แสดงเส้นทาง Happy Path และ Unhappy Path เมื่อเกิดเหตุขัดข้อง:

```mermaid
flowchart TD
    Start(["ผู้ใช้เดินเข้ามาหน้าตู้ Photo Booth"]) --> StandFront["ยืนหน้ากล้องในระยะ 1.2 - 2.0 เมตร"]
    StandFront --> DetectMode{"เลือกสั่งถ่ายภาพด้วยวิธีใด?"}
    
    DetectMode -->|วิธีหลัก: AI Gesture| PoseHand["แบมือ 5 นิ้ว (Open Palm) เข้าหากล้อง"]
    DetectMode -->|วิธีสำรอง: Touch| TapScreen["แตะปุ่ม 'แตะเพื่อถ่าย' บนหน้าจอ"]

    PoseHand --> HoldCheck{"ทำท่ามือค้างต่อเนื่อง<br>ครบ 1.5 วินาทีหรือไม่?"}
    HoldCheck -->|ไม่ครบ / คนเดินผ่าน| ResetPose["ยกเลิกการนับ กลับสู่สถานะรอ (Idle)"]
    ResetPose --> StandFront
    HoldCheck -->|ครบ 1.5 วิ| StartCountdown["เริ่มนับถอยหลัง Visual Timer 3.. 2.. 1.."]
    TapScreen --> StartCountdown

    StartCountdown --> FlashCapture["แชะ! หน้าจอกะพริบ Flash 100ms และบันทึกภาพ"]
    FlashCapture --> ShowPreview["แสดงภาพพรีวิวทันที + ปุ่ม 'ถ่ายใหม่' (นับถอยหลัง 5-8 วิ)"]

    ShowPreview --> RetakeCheck{"ผู้ใช้ต้องการถ่ายใหม่หรือไม่?"}
    RetakeCheck -->|กดถ่ายใหม่ (สิทธิ์ 1 ครั้ง)| StartCountdown
    RetakeCheck -->|ไม่กด / ปล่อยเวลาหมด| GenQR["สร้าง Short Code (SWU-XXXX) และแสดง QR Code"]

    GenQR --> ScanOrNote{"ผู้ใช้เลือกรับภาพอย่างไร?"}
    ScanOrNote -->|สแกนทันที| MobileWeb["เปิดเว็บเบราว์เซอร์บนมือถือ (/p/[code])"]
    ScanOrNote -->|สแกนไม่ทัน / เน็ตหมุน| PhotoScreen["ใช้มือถือถ่ายรูปหน้าจอที่มีรหัส SWU-XXXX เก็บไว้"]

    PhotoScreen --> GoHome["เปิดเว็บ /find ภายใน 7 วัน แล้วกรอกรหัส"]
    GoHome --> MobileWeb

    subgraph MobileFlow["ขั้นตอนการแต่งภาพบนมือถือ (ไม่ขวางคิวตู้)"]
        MobileWeb --> Step1["ขั้นตอนที่ 1: เลือกฟิลเตอร์แต่งสี (6 พรีเซ็ต + ปรับสว่าง)"]
        Step1 --> Step2["ขั้นตอนที่ 2: เลือกกรอบรูป มศว (1 ใน 3 แบบ)"]
        Step2 --> Step3["ขั้นตอนที่ 3: กด 'ดาวน์โหลดรูปภาพ' ลง Camera Roll"]
        Step3 --> ShareSocial["แชร์ลง Instagram Story / TikTok พร้อมแฮชแท็ก #SWUOpenHouse"]
    end

    ShareSocial --> End(["เสร็จสิ้นประสบการณ์"])
```

### 3.2 User Flow สำหรับสตาฟประจำบูท (Staff Journey)

```mermaid
flowchart TD
    StaffStart(["สตาฟประจำบูทเข้าปฏิบัติงาน"]) --> AccessMethod{"เลือกเข้าถึงระบบด้วยวิธีใด?"}
    
    AccessMethod -->|หน้าตู้ Kiosk| TouchLogo["แตะที่โลโก้ มศว มุมบนซ้าย 5 ครั้งติดกัน<br>(หรือกด Ctrl+Shift+A)"]
    AccessMethod -->|มือถือสตาฟ| OpenAdmin["เปิดเว็บ https://<domain>/admin ผ่าน Local Wi-Fi"]

    TouchLogo --> EnterPIN["กรอกรหัส Staff PIN 4-6 หลัก"]
    OpenAdmin --> EnterPIN

    EnterPIN --> PINCheck{"รหัส PIN ถูกต้องหรือไม่?"}
    PINCheck -->|ไม่ถูกต้องเกิน 5 ครั้ง| Lockout["ล็อกหน้าจอ 1 นาที (Rate Limit Protection)"]
    PINCheck -->|ถูกต้อง| StaffDashboard["เข้าสู่ Staff Control Panel"]

    StaffDashboard --> ActionSelect{"เลือกคำสั่งที่ต้องการทำ"}
    ActionSelect --> ResetKiosk["1. สั่งรีเซ็ตตู้กลับสู่หน้าแรกทันที (Clear Session)"]
    ActionSelect --> SwitchCam["2. สลับกล้อง หรือปรับ Calibration ความไวของมือ"]
    ActionSelect --> ViewStats["3. ดูสถิติจำนวนผู้ถ่ายและคิวที่ยังไม่อัปโหลด"]
    ActionSelect --> ForceSync["4. สั่ง Force Sync อัปโหลดรูปภาพที่ค้างในเครื่องตู้"]

    ResetKiosk --> LogAction["บันทึก Audit Log"]
    SwitchCam --> LogAction
    ViewStats --> LogAction
    ForceSync --> LogAction
    LogAction --> StaffEnd(["ปิดหน้าต่างสตาฟ ตู้พร้อมใช้งานต่อ"])
```

### 3.3 User Flow สำหรับผู้ดูแลระบบ (Admin Journey - PDPA Lifecycle)

```mermaid
flowchart TD
    AdminStart(["Cron Job อัตโนมัติทุกเที่ยงคืน (00:00 UTC)"]) --> ScanDB["สแกนหารายการภาพที่มี CreatedAt เกิน 7 วัน"]
    ScanDB --> ExpiredFound{"พบภาพถ่ายที่หมดอายุหรือไม่?"}
    
    ExpiredFound -->|ไม่พบ| SleepJob["สิ้นสุดรอบ รอรอบถัดไป"]
    ExpiredFound -->|พบ N รายการ| DeleteR2["ลบไฟล์ภาพต้นฉบับและภาพคอมโพสิตใน Cloudflare R2"]

    DeleteR2 --> DeleteMetadata["ลบรหัส Short Code และ Session ในฐานข้อมูล"]
    DeleteMetadata --> RecordRoPA["บันทึก Log การทำลายข้อมูลส่วนบุคคลตามกฎหมาย PDPA"]
    RecordRoPA --> SleepJob
```

---

## ส่วนที่ 4: ลำดับการทำงานของกระบวนการสำคัญ (Sequence Diagrams)

### 4.1 Sequence 01: Touchless Hand Gesture Capture & Countdown Loop
ลำดับการทำงานเมื่อผู้ใช้ยกมือสั่งถ่ายภาพ:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as ผู้ร่วมงาน (Visitor)
    participant Camera as กล้อง USB 1080p
    participant MediaPipe as MediaPipe Engine (WebGL)
    participant Controller as Gesture Controller
    participant UI as Kiosk UI Viewfinder

    Visitor->>Camera: ยืนหน้ากล้อง และยกมือแบ 5 นิ้ว (Open Palm)
    loop ทุก 16ms (60 FPS)
        Camera->>MediaPipe: ส่ง Video Frame Stream (1080p)
        MediaPipe->>MediaPipe: ตรวจจับ 21 Hand Landmarks
        MediaPipe->>Controller: ส่งพิกัดตำแหน่งมือและแกนความลึก z
        Controller->>Controller: กรองขนาดมือที่ใหญ่และใกล้ที่สุด (Depth Filter)
        Controller->>Controller: ตรวจสอบท่าทาง Open Palm
        alt ท่าทางถูกต้องต่อเนื่อง
            Controller->>Controller: นับเวลาสะสม (Hold Timer += delta)
            Controller->>UI: อัปเดต Progress วงแหวนสีรอบมือ (0% -> 100%)
        else มือหลุดเฟรม / ขยับเปลี่ยนท่า
            Controller->>Controller: รีเซ็ต Hold Timer = 0
            Controller->>UI: ล้าง Progress วงแหวน
        end
    end

    Note over Controller,UI: เมื่อ Hold Timer ครบ 1.5 วินาที
    Controller->>UI: ส่งสัญญาณ Trigger: START_COUNTDOWN
    UI->>Visitor: เล่นเสียง Beep + แสดงตัวเลข 3.. 2.. 1.. (ช่วงละ 1 วินาที)
    UI->>Camera: สั่ง Freeze Frame ที่วินาทีที่ 0
    UI->>Visitor: แสดง Effect จอขาว (White Flash) 100ms
    UI->>UI: เปลี่ยนสถานะเป็น SHOW_PREVIEW
```

### 4.2 Sequence 02: Image Capture, Preview & Retake Logic
ลำดับการตัดสินใจว่าจะถ่ายใหม่หรือส่งออก QR Code:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as ผู้ร่วมงาน (Visitor)
    participant UI as Kiosk UI Viewfinder
    participant CaptureEngine as Capture Engine
    participant StorageBuffer as Local Buffer (SSD)

    CaptureEngine->>StorageBuffer: บันทึกภาพดิบ 1080p ลง Local Buffer ชั่วคราว
    CaptureEngine->>UI: เรนเดอร์ภาพพรีวิวบนหน้าจอ
    UI->>Visitor: แสดงภาพพรีวิว + ปุ่ม "ถ่ายใหม่ (Retake)" + เวลานับถอยหลัง 8.. 7.. 6..

    alt กรณีที่ 1: ผู้ใช้กดปุ่ม "ถ่ายใหม่" (ภายใน 8 วินาที)
        Visitor->>UI: แตะปุ่ม "ถ่ายใหม่"
        UI->>StorageBuffer: ยกเลิกภาพดิบเดิม
        UI->>UI: รีเซ็ตสิทธิ์การถ่ายใหม่ (RetakeCount = 1)
        UI->>Visitor: เริ่มนับถอยหลัง 3.. 2.. 1.. ถ่ายรอบใหม่ทันที
    else กรณีที่ 2: ผู้ใช้ไม่กด หรือเวลานับถอยหลังหมดลง (Auto-Confirm)
        UI->>UI: สิ้นสุดเวลา Retake
        UI->>CaptureEngine: ยืนยันภาพถ่าย (CONFIRM_CAPTURE)
        UI->>UI: เปลี่ยนสถานะเป็น GENERATING_QR
    end
```

### 4.3 Sequence 03: Storage Upload, Short Code & QR Generation (พร้อม Offline Fallback)
แสดงความทนทานต่อเน็ตเวิร์ก หากเน็ตในงานดับ ตู้ต้องไม่หยุดทำงาน:

```mermaid
sequenceDiagram
    autonumber
    participant UI as Kiosk UI Screen
    participant CodeGen as Short Code Generator
    participant OfflineQueue as IndexedDB Buffer
    participant SyncWorker as Background Sync Worker
    participant CloudAPI as Cloudflare R2 / Serverless API

    UI->>CodeGen: ขอรหัสสั้นประจำรูปภาพ
    CodeGen->>CodeGen: สุ่มรหัส 4 หลักที่ไม่ซ้ำ (เช่น SWU-7K9A)
    CodeGen-->>UI: ส่งคืนรหัส SWU-7K9A และ URL: https://booth.swu.ac.th/p/SWU-7K9A
    
    UI->>UI: เรนเดอร์ QR Code และรหัส SWU-7K9A บนหน้าจอทันที (< 200ms)
    UI->>OfflineQueue: บันทึกรูปภาพ + Metadata (SWU-7K9A) ลง Local Disk เครื่องตู้

    Note over OfflineQueue,SyncWorker: กระบวนการอัปโหลดทำงานเบื้องหลัง (Background Worker)
    SyncWorker->>OfflineQueue: ดึงรูปภาพที่รออัปโหลดจาก Queue
    SyncWorker->>CloudAPI: ทำการอัปโหลดรูปภาพผ่าน POST /api/upload

    alt เน็ตปกติ (Online 200 OK)
        CloudAPI-->>SyncWorker: อัปโหลดสำเร็จ (Uploaded: true)
        SyncWorker->>OfflineQueue: ทำเครื่องหมายสถานะว่า Synced แล้ว
    else เน็ตงานขัดข้อง / Timeout (Offline)
        CloudAPI--xSyncWorker: ไม่สามารถเชื่อมต่อได้ (Network Error)
        SyncWorker->>OfflineQueue: คงสถานะ Pending ไว้ในเครื่องตู้
        SyncWorker->>SyncWorker: ตั้งเวลา Exponential Backoff Retry (5s, 10s, 30s)
        Note over UI: หน้าตู้ยังคงให้บริการคนต่อไปได้ตามปกติ ไม่ค้าง!
    end
```

### 4.4 Sequence 04: Mobile Customization (Color Grading + 3 Frame Templates + Download)
ขั้นตอนการแต่งภาพบนสมาร์ตโฟนของผู้ใช้งาน:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as ผู้ร่วมงาน (Visitor)
    participant MobileBrowser as มือถือ (iOS Safari / Chrome)
    participant CDN as Cloudflare R2 / Edge CDN
    participant Canvas as HTML5 Canvas 2D
    participant DeviceStorage as Camera Roll (มือถือ)

    Visitor->>MobileBrowser: สแกน QR Code เข้าสู่ https://booth.swu.ac.th/p/SWU-7K9A
    MobileBrowser->>CDN: ขอไฟล์ภาพต้นฉบับ /photos/original/SWU-7K9A.jpg
    CDN-->>MobileBrowser: ส่งไฟล์ภาพความละเอียดสูง (1080p)
    MobileBrowser->>Canvas: โหลดภาพลงใน Offscreen Canvas

    Note over Visitor,Canvas: ขั้นตอนที่ 1: การแต่งสีภาพ (Color Grading)
    Visitor->>MobileBrowser: แตะเลือกฟิลเตอร์ (เช่น Rosy Bright) หรือเลื่อนปรับความสว่าง
    MobileBrowser->>Canvas: คำนวณ Color Transform / LUT Matrix
    Canvas-->>MobileBrowser: แสดงผลพรีวิวแบบเรียลไทม์ (Live Preview < 16ms)

    Visitor->>MobileBrowser: แตะปุ่ม "ถัดไป: เลือกกรอบรูป"

    Note over Visitor,Canvas: ขั้นตอนที่ 2: การเลือกกรอบรูป 3 แบบ (Frame Layering)
    MobileBrowser->>CDN: ดึงกราฟิกกรอบ PNG โปร่งใสทั้ง 3 แบบ
    Visitor->>MobileBrowser: แตะเลือก "Template 02: ลายเปิดบ้าน มศว สดใส"
    MobileBrowser->>Canvas: วาดภาพถ่ายใต้เลเยอร์กรอบรูป PNG (Alpha Blending)
    Canvas-->>MobileBrowser: แสดงภาพคอมโพสิตที่ผสานเสร็จสมบูรณ์

    Note over Visitor,DeviceStorage: ขั้นตอนที่ 3: การส่งออกและดาวน์โหลด (Export)
    Visitor->>MobileBrowser: แตะปุ่ม "ดาวน์โหลดรูปภาพ (Save Photo)"
    Canvas->>Canvas: แปลง Canvas เป็น Blob (image/webp หรือ image/jpeg คุณภาพ 0.92)
    MobileBrowser->>DeviceStorage: บันทึกไฟล์ภาพลงใน Photos / Gallery ของมือถือ
    MobileBrowser->>Visitor: แสดงข้อความแจ้งเตือน "บันทึกภาพสำเร็จ!"
```

### 4.5 Sequence 05: Retroactive Photo Retrieval (`/find`) & Open House Verification
กรณีที่ผู้ใช้ไม่ได้สแกนทันที แต่นำรหัสมากรอกย้อนหลัง:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as ผู้ร่วมงาน (Visitor)
    participant Browser as Web Browser (/find)
    participant API as /api/photo/[code]
    participant KV as Metadata Cache
    participant R2 as Cloudflare R2

    Visitor->>Browser: เข้าเว็บ https://booth.swu.ac.th/find และพิมพ์รหัส "SWU-7K9A"
    Browser->>API: ส่งคำขอ GET /api/photo/SWU-7K9A
    API->>KV: ค้นหาข้อมูลรหัส SWU-7K9A

    alt รหัสถูกต้องและยังไม่หมดอายุ 7 วัน
        KV-->>API: พบข้อมูล (CreatedAt: 2026-11-07, FileKey: photos/...)
        API-->>Browser: ส่งคืนสถานะ 200 OK + CDN URL
        Browser->>Visitor: เปลี่ยนหน้าจอไปที่ /p/SWU-7K9A เพื่อแต่งรูปและดาวน์โหลดทันที
    else รหัสไม่ถูกต้อง หรือเกิน 7 วัน (ถูกลบตาม PDPA แล้ว)
        KV-->>API: ไม่พบข้อมูล (Null / Expired)
        API-->>Browser: ส่งคืนสถานะ 404 Not Found
        Browser->>Visitor: แสดงข้อความแจ้งเตือน "ไม่พบรหัสภาพ หรือภาพถ่ายหมดอายุแล้ว (เกิน 7 วัน)"
    end
```

### 4.6 Sequence 06: Staff PIN Authentication & Remote Kiosk Control
การเข้าควบคุมระบบของสตาฟ:

```mermaid
sequenceDiagram
    autonumber
    actor Staff as สตาฟประจำบูท
    participant KioskUI as หน้าจอ Kiosk
    participant StaffModal as Staff Modal
    participant Backend as Admin API
    participant WebSocket as WebSocket / SSE Bus

    Staff->>KioskUI: แตะโลโก้ มศว มุมซ้ายบน 5 ครั้งติดกัน
    KioskUI->>StaffModal: เปิดหน้าต่างลับ Staff PIN Modal
    Staff->>StaffModal: กรอกรหัส PIN "8821"
    StaffModal->>Backend: ตรวจสอบความถูกต้องของ PIN
    
    alt PIN ถูกต้อง
        Backend-->>StaffModal: 200 OK (Auth Success)
        StaffModal->>Staff: แสดงเมนูควบคุม (สลับกล้อง, รีเซ็ตตู้, บังคับซิงค์)
        Staff->>StaffModal: กดปุ่ม "รีเซ็ตตู้ (Emergency Reset)"
        StaffModal->>KioskUI: สั่งเคลียร์ State ทั้งหมด กลับสู่สถานะ IDLE พร้อมใช้งาน
    else PIN ผิดเกิน 5 ครั้ง
        Backend-->>StaffModal: 429 Too Many Requests (Lockout 60s)
        StaffModal->>Staff: ล็อกหน้าจอชั่วคราว ป้องกันการสุ่มรหัส
    end
```

---

## ส่วนที่ 5: การจัดการข้อผิดพลาดและข้อยกเว้น (Error Handling & Edge Cases)

ตารางสรุปพฤติกรรมของระบบเมื่อเกิดเหตุการณ์ผิดปกติ (Fault Matrix):

| เหตุการณ์ผิดปกติ (Failure Event) | ผลกระทบที่อาจเกิดขึ้น | กลไกการตรวจจับและการจัดการ (Handling Mechanism) | พฤติกรรมที่ผู้ใช้เห็นบนหน้าจอ |
| :--- | :--- | :--- | :--- |
| **1. กล้อง USB หลุด หรือสายหลวม** | หน้าจอ Viewfinder มืดดำ ตู้ถ่ายรูปไม่ได้ | เบราว์เซอร์ตรวจพบ `track.onended` หรือ `devicechange` event | หน้าจอแสดงป้ายสีส้ม: *"กล้องขัดข้อง กรุณาแจ้งเจ้าหน้าที่สตาฟ"* พร้อมส่งเสียงเตือนสตาฟ |
| **2. ผู้ใช้เดินหนีขณะนับถอยหลัง** | กล้องถ่ายรูปพื้นที่ว่างเปล่า ค้างที่หน้าพรีวิว | จับเวลา Timeout ในหน้าพรีวิว 8 วินาที | หากไม่มีใครกดถ่ายใหม่ ระบบจะข้ามไปหน้า QR Code 5 วินาทีแล้วรีเซ็ตกลับหน้าแรกเองอัตโนมัติ |
| **3. สัญญาณอินเทอร์เน็ตในงานดับ** | อัปโหลดรูปขึ้นคลาวด์ไม่ได้ | API Fetch โยนข้อผิดพลาด `TypeError: Failed to fetch` | ระบบจะสวิตช์เข้าสู่ **โหมด Offline อัตโนมัติ**: บันทึกลงไดรฟ์ตู้ โชว์ QR Code ทันที และมี Sync Queue คอย Retry |
| **4. แสงไฟในบูทมืดเกินไป** | MediaPipe ตรวจจับข้อต่อนิ้วมือไม่ติด | Confidence Score ของ Landmarks < 0.6 ติดต่อกันเกิน 3 วินาที | แสดงปุ่มขนาดใหญ่บนหน้าจอ: *"แตะตรงนี้เพื่อถ่ายรูป (Tap to capture)"* เป็นทางเลือกสำรอง |
| **5. เบราว์เซอร์มือถือน้องแบตหมดขณะแต่งภาพ** | ภาพที่กำลังแต่งสีอาจสูญหาย | การแต่งสีทั้งหมดทำแบบ Stateless บนมือถือ | น้องสามารถเปิดลิงก์เดิมบนมือถือเพื่อน หรือเข้า `/find` เพื่อแต่งภาพใหม่ได้ตลอด 7 วัน |
