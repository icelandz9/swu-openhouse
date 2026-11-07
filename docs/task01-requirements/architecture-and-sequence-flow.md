# สถาปัตยกรรมระบบ แผนผังเส้นทางผู้ใช้ และลำดับการทำงาน (System Architecture, User Flow & Sequence Diagrams)
## ระบบ AI Photo Booth สำหรับงานเปิดบ้าน มศว (SWU Open House)
**โครงการ**: SWU Open House - Pure AI Photo Booth System  
**เวอร์ชัน**: 2.1 (Updated: OPH Code Prefix, Clean QR on Kiosk, Mobile Code Retention & Staff QR Re-Issue Portal)  
**วันที่**: 7 พฤศจิกายน 2026  
**มาตรฐานอ้างอิง**:
- **IEEE 1016-2009** (Standard for Information Technology - Systems Design - Software Design Descriptions)
- **C4 Model** (Context, Container, Component, Code)
- **UML 2.5** (Unified Modeling Language - Activity & Sequence Diagrams)

---

## 📌 บทนำและขอบเขตสถาปัตยกรรม (Architectural Scope)
สถาปัตยกรรมนี้มุ่งเน้น **ระบบ AI Photo Booth อย่างเป็นรูปธรรม 100%** โดยมีข้อกำหนดพิเศษตามที่กำหนด:
1. **รหัส Short Code ใช้ Prefix `OPH-XXXX`** (แทน `SWU-XXXX`)
2. **หน้าจอตู้ Kiosk แสดงเฉพาะ QR Code**: ไม่แสดงตัวเลข Short Code บนหน้าตู้ถ่าย เพื่อความสะอาด เรียบง่าย และกระตุ้นการสแกนทันที
3. **รหัส `OPH-XXXX` จะแสดงบนหน้าจอมือถือของน้อง**: หลังจากสแกน QR น้องจะเห็นรหัสของตัวเองที่หัวเว็บมือถือเพื่อจดหรือบันทึกเก็บไว้ดึงรูปย้อนหลัง
4. **ระบบหลังบ้านสตาฟสำหรับยิง QR ย้อนหลัง (Staff QR Re-Issue Portal)**: หากน้องสแกนไม่ทันหรือลืมสแกน น้องสามารถเดินมาหาสตาฟ โดยสตาฟเปิดดูแกลเลอรีภาพถ่ายล่าสุดตามเวลาบนระบบหลังบ้าน `/admin` แล้วแตะที่รูปเพื่อเปิด QR Code ให้น้องสแกนได้ทันที

---

## ส่วนที่ 1: แผนผังโครงสร้างระบบภาพรวม (High-Level Architecture - C4 Context & Container)

### 1.1 C4 Context Diagram (บริบทของระบบ Photo Booth และโมเดล AI)

```mermaid
flowchart TD
    subgraph Actors["กลุ่มผู้ใช้งาน (Actors)"]
        V["นักเรียนมัธยม หรือผู้ปกครอง<br>[Visitor]"]
        S["เจ้าหน้าที่สตาฟประจำบูท<br>[Staff Operator]"]
        A["ผู้ดูแลระบบคลาวด์<br>[System Admin]"]
    end

    subgraph HardwareLayer["ฮาร์ดแวร์หน้าตู้ (Onsite Hardware)"]
        Webcam["USB Webcam 1080p<br>[Hardware Device]"]
        Screen["มอนิเตอร์ 16:9 แนวนอน<br>[Hardware Display]"]
    end

    subgraph PhotoBoothSystem["ระบบ SWU AI Photo Booth System (Next.js Monorepo)"]
        AI_Model["โมเดล AI Keypoint Detection<br>(Google MediaPipe 21 Hand Landmarks Model)<br>[AI Vision Engine]"]
        Kiosk["หน้าจอถ่ายภาพตู้ Kiosk<br>(/booth - Viewfinder & FSM)<br>[Next.js Client]"]
        Mobile["เว็บแอปแต่งภาพบนมือถือ<br>(/p/[code], /find)<br>[Next.js Client]"]
        AdminPortal["แดชบอร์ดสตาฟบนมือถือ<br>(/admin - PIN Protected & QR Re-issue)<br>[Next.js Client]"]
        API["Serverless API Routes<br>(/api/upload, /api/photo, /api/admin)<br>[Next.js Backend]"]
    end

    subgraph CloudLayer["ระบบคลาวด์และพื้นที่จัดเก็บ (Cloud Infrastructure)"]
        R2["Cloudflare R2 Storage<br>(S3-Compatible, Egress Free)<br>[TTL 7 Days Auto-Purge]"]
        VercelEdge["Vercel Edge Network<br>(Global CDN, HTTPS & SSL)"]
        KV["Cloudflare KV หรือ Supabase<br>(Short Code Map: OPH-XXXX)"]
    end

    V -->|"1. ยืนระยะ 1.5 ม. แบมือ 5 นิ้ว"| Webcam
    Webcam -->|"ส่งสตรีมวิดีโอ 1080p (WebRTC)"| AI_Model
    AI_Model -->|"ส่งผลพิกัด 21 Keypoints และท่าทางที่ตรวจจับได้"| Kiosk
    Kiosk -->|"แสดงภาพ Viewfinder และ QR Code (ไม่โชว์รหัสตัวอักษร)"| Screen
    V -->|"2. สแกน QR Code ด้วยมือถือ"| Mobile

    Mobile -->|"ดึงภาพถ่ายต้นฉบับ 1080p"| R2
    Mobile -->|"แสดงรหัส OPH-XXXX ให้น้องเก็บไว้ และประมวลผล Canvas"| Mobile

    S -->|"แตะโลโก้ 5 ครั้ง และใส่ PIN"| Kiosk
    S -->|"เข้าผ่าน Wi-Fi บูท (/admin)"| AdminPortal
    AdminPortal -->|"ค้นหาภาพตามเวลาเพื่อ Re-issue QR ให้น้อง"| API
    V -.->|"กรณีลืมสแกน: เดินมาขอ QR จากสตาฟ"| S

    A -->|"ตรวจสอบความปลอดภัย และ PDPA"| R2
    A -->|"Audit Log"| KV

    Kiosk -->|"อัปโหลดรูปภาพ POST /api/upload"| API
    API -->|"บันทึกไฟล์ภาพต้นฉบับ"| R2
    API -->|"แมป Short Code OPH-XXXX"| KV
    VercelEdge -->|"เสิร์ฟ Static Assets และ Web App"| Kiosk
    VercelEdge -->|"เสิร์ฟ Web App บนมือถือ"| Mobile
```

### 1.2 C4 Container Diagram (Frontend, AI Model Pipeline, Backend, Storage & CDN)

```mermaid
flowchart LR
    subgraph ClientContainers["ฝั่งผู้ใช้งาน (Client Applications)"]
        subgraph KioskApp["Kiosk Web Application (/booth)"]
            K_UI["React Viewfinder UI<br>[React 19 + CSS]"]
            
            subgraph AIPipeline["ระบบประมวลผล AI Keypoint Vision"]
                Model_Landmarker["โมเดล Keypoint Detection<br>(hand_landmarker.task)<br>[TFLite Neural Net in WebGL]"]
                Extractor["21 Hand Landmarks Extractor<br>[3D Coordinates x, y, z]"]
                Classifier["Gesture Rule Classifier<br>[Open Palm — ขยายเพิ่มท่าได้]"]
                DebounceFilter["Debounce & Depth Filter<br>[1.5s Hold & Largest Area]"]
            end
            
            K_FSM["Kiosk Finite State Machine<br>[Idle, Detect, Count, QR]"]
            K_Cache["Local Disk Buffer (SSD)<br>[Offline Resilience Queue]"]
        end

        subgraph MobileApp["Mobile Web Application (/p/[code])"]
            M_UI["Mobile Step-by-Step UI<br>[แสดง OPH-XXXX + Color -> Frame]"]
            M_Canvas["HTML5 Canvas 2D Engine<br>[Color Presets + PNG Frames]"]
            M_Exporter["Blob & File Exporter<br>[Camera Roll Saver]"]
        end

        subgraph StaffApp["Staff Portal (/admin)"]
            S_UI["Staff Dashboard & Recent Gallery<br>[Timeline Re-issue QR Modal]"]
        end
    end

    subgraph ServerContainers["ฝั่งเซิร์ฟเวอร์ (Serverless Architecture)"]
        subgraph NextServer["Next.js Route Handlers"]
            UploadHandler["/api/upload<br>[Multipart Form Streamer]"]
            PhotoHandler["/api/photo/[code]<br>[Metadata Resolver]"]
            AdminHandler["/api/admin/*<br>[Recent Gallery & PIN Auth]"]
        end
    end

    subgraph DataContainers["ฝั่งจัดเก็บข้อมูล (Data & Storage)"]
        R2Bucket["Cloudflare R2 Object Storage<br>/photos/original/OPH-XXXX.jpg<br>[Retention: 7 Days]"]
        KVStore["Metadata & Short Code Store<br>OPH-XXXX -> {createdAt, status}"]
        EdgeCDN["Vercel Edge / Cloudflare CDN<br>[Caching & Asset Delivery]"]
    end

    K_UI -->|"ส่ง Video Frame (1080p)"| Model_Landmarker
    Model_Landmarker -->|"Inference 60 FPS"| Extractor
    Extractor -->|"พิกัด 21 จุด"| DebounceFilter
    DebounceFilter -->|"มือใกล้สุด"| Classifier
    Classifier -->|"คำสั่งสั่งถ่าย (Trigger)"| K_FSM

    K_FSM --> K_Cache
    K_Cache -.->|"Async Background Upload"| UploadHandler

    UploadHandler --> R2Bucket
    UploadHandler --> KVStore

    M_UI --> M_Canvas
    M_Canvas --> M_Exporter
    M_UI --> PhotoHandler
    PhotoHandler --> KVStore
    PhotoHandler --> R2Bucket

    S_UI --> AdminHandler
    AdminHandler --> KVStore
    AdminHandler --> R2Bucket

    EdgeCDN --> K_UI
    EdgeCDN --> M_UI
    EdgeCDN --> S_UI
```

### 1.3 C4 Component Diagram: สถาปัตยกรรมภายในของ AI Keypoint Detection Pipeline

```mermaid
flowchart TD
    subgraph KioskAIModule["Kiosk AI Keypoint Vision Subsystem"]
        WebcamStream["WebRTC Stream Receiver<br>[navigator.mediaDevices.getUserMedia]"]
        FrameBuffer["Video Frame Preprocessor<br>[WebGL GPU Texture Binder]"]
        
        subgraph KeypointModel["AI Keypoint Detection Neural Network Model"]
            DetectionModel["Palm Detector Model<br>[BlazePalm SSD Anchor Detector]"]
            LandmarkModel["Hand Landmark Model<br>[21 3D Points Keypoint Regression]"]
        end
        
        LandmarkData["Raw 21 Keypoints Data<br>[x: 0..1, y: 0..1, z: Depth]"]
        DepthAreaFilter["Largest Area & Depth Filter<br>[Filter Out Background People]"]
        GestureEvaluator["Gesture Geometry Evaluator<br>[Open Palm — ขยายเพิ่มท่าได้]"]
        HoldController["Hold Duration Controller<br>[1.5s Continuous Hold Counter]"]
        TriggerDispatch["Capture Trigger Event Dispatcher<br>[Trigger Countdown 5..4..3..2..1..]"]
    end

    WebcamStream --> FrameBuffer
    FrameBuffer --> DetectionModel
    DetectionModel --> LandmarkModel
    LandmarkModel --> LandmarkData
    LandmarkData --> DepthAreaFilter
    DepthAreaFilter --> GestureEvaluator
    GestureEvaluator --> HoldController
    HoldController --> TriggerDispatch
```

---

## ส่วนที่ 2: สถาปัตยกรรมเชิงลึก (Low-Level Architecture: State Machine & Component Tree)

### 2.1 State Machine ของตู้ถ่ายภาพ (Kiosk Finite State Machine - FSM)
ตู้ทำงานแบบ Stateless & Resilient แยกจากมือถือโดยสิ้นเชิง:

```mermaid
stateDiagram-v2
    [*] --> IDLE : เริ่มต้นระบบ / รีเซ็ต

    IDLE --> DETECTING_HAND : กล้องตรวจพบมือขวาหรือซ้าย
    DETECTING_HAND --> IDLE : มือหลุดเฟรม หรือไม่ครบ 1.5 วินาที
    DETECTING_HAND --> COUNTDOWN : แบมือ 5 นิ้วค้างต่อเนื่องครบ 1.5 วินาที
    IDLE --> COUNTDOWN : ผู้ใช้แตะปุ่ม แตะเพื่อถ่าย Touch Fallback

    COUNTDOWN --> FLASH_CAPTURE : นับถอยหลัง 5.. 4.. 3.. 2.. 1.. ถึงศูนย์
    FLASH_CAPTURE --> PREVIEW_RETAKE : บันทึกภาพ 1080p และแสดงจอขาว Flash 100ms

    PREVIEW_RETAKE --> COUNTDOWN : ผู้ใช้กด ถ่ายใหม่ Retake จำกัด 1 ครั้ง
    PREVIEW_RETAKE --> QR_DISPLAY : ผู้ใช้กด ยืนยัน หรือปล่อยเวลานับถอยหลัง 8 วินาทีหมดลง

    QR_DISPLAY --> IDLE : ผู้ใช้กดปุ่ม เสร็จสิ้นคนถัดไป หรือหมดเวลา 15-20 วินาที
    
    state STAFF_OVERRIDE {
        [*] --> STAFF_MENU : แตะโลโก้ 5 ครั้ง และใส่ PIN ถูกต้อง
        STAFF_MENU --> IDLE : สั่งรีเซ็ตตู้ หรือบังคับคืนสถานะ
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
    HoldCheck -->|"ครบ 1.5 วินาที"| StartTimer["เริ่มนับถอยหลัง 5.. 4.. 3.. 2.. 1.. พร้อมเสียง Beep"]
    TouchTap --> StartTimer

    StartTimer --> Flash["แชะ หน้าจอกะพริบขาว 100ms และบันทึกภาพ"]
    Flash --> Preview["แสดงภาพพรีวิวทันที และปุ่มถ่ายใหม่ นับถอยหลัง 8 วิ"]

    Preview --> RetakeCheck{"ต้องการถ่ายใหม่หรือไม่"}
    RetakeCheck -->|"กดถ่ายใหม่ สิทธิ์ 1 ครั้ง"| StartTimer
    RetakeCheck -->|"ไม่กด หรือปล่อยเวลาหมด 8 วิ"| GenQR["สร้างรหัส OPH-XXXX และสร้าง QR Code"]

    GenQR --> ShowQRScreen["หน้าจอแสดงเฉพาะ QR Code ขนาดใหญ่ นับถอยหลัง 15-20 วิ และปุ่มคนถัดไป ไม่โชว์รหัสตัวอักษร"]

    ShowQRScreen --> VisitorAction{"ผู้ใช้งานดำเนินการอย่างไร"}
    VisitorAction -->|"สแกนด้วยมือถือทันที"| ScanQR["เปิดเว็บเบราว์เซอร์บนมือถือ /p/OPH-XXXX"]
    VisitorAction -->|"สแกนไม่ทัน หรือลืมสแกน"| AskStaff["เดินมาหาพี่สตาฟที่บูท เพื่อขอ QR ย้อนหลัง"]
    VisitorAction -->|"กดปุ่ม คนถัดไป"| DoneKiosk["ตู้พร้อมให้บริการคิวถัดไปทันที ใช้เวลาหน้าตู้ประมาณ 30 วิ"]

    AskStaff --> StaffFind["สตาฟเปิด /admin เลื่อนดูรูปตามเวลา แล้วเปิด QR ให้น้องสแกน"]
    StaffFind --> ScanQR

    subgraph MobileExperience["ขั้นตอนแต่งภาพบนมือถือของผู้ใช้"]
        ScanQR --> CodeBanner["หน้าเว็บมือถือแสดงรหัส OPH-XXXX ชัดเจนที่หัวเว็บ ให้น้องจดหรือแคปเก็บไว้"]
        CodeBanner --> Step1["ขั้นตอนที่ 1 แต่งสี แตะเลือก 1 ใน 6 พรีเซ็ต หรือปรับ Brightness Slider"]
        Step1 --> Step2["ขั้นตอนที่ 2 เลือกกรอบ สลับเลือก 1 ใน 3 กรอบรูป CPE SWU"]
        Step2 --> Step3["ขั้นตอนที่ 3 ดาวน์โหลด กดปุ่ม บันทึกรูปภาพ ลง Camera Roll"]
        Step3 --> Share["แชร์ลง Instagram Story หรือ TikTok ทันที"]
    end

    Share --> End(["จบกิจกรรมอย่างประทับใจ"])
```

### 3.2 Staff Flow: เส้นทางการปฏิบัติงานและการช่วยเหลือออก QR ย้อนหลัง

```mermaid
flowchart TD
    StaffStart(["สตาฟประจำบูทเข้าควบคุมระบบ"]) --> ChooseTask{"เลือกภารกิจที่ต้องการทำ"}

    ChooseTask -->|"1. น้องเดินมาขอ QR Code ย้อนหลัง"| ReissueTask["เปิดแท็บ Recent Captures Timeline บน /admin"]
    ChooseTask -->|"2. ควบคุมและบำรุงรักษาตู้"| KioskControl["แตะโลโก้ 5 ครั้งบนหน้าตู้ หรือเข้า /admin"]

    ReissueTask --> AskTime["สอบถามน้องว่าถ่ายเวลาประมาณกี่โมง เช่น 14:32 น."]
    AskTime --> BrowseTimeline["เลื่อนดูภาพพรีวิวที่เรียงตามเวลาที่ถ่ายล่าสุด"]
    BrowseTimeline --> SelectPhoto["แตะที่รูปภาพที่ตรงกัน"]
    SelectPhoto --> ShowStaffQR["ระบบเด้ง Modal ขยายรูปใหญ่ พร้อม QR Code และรหัส OPH-XXXX"]
    ShowStaffQR --> VisitorScan["น้องนำมือถือมาสแกน QR Code จากหน้าจอของสตาฟ"]
    VisitorScan --> StaffDone(["สำเร็จ น้องได้รูปเข้ามือถือทันที"])

    KioskControl --> PromptPIN["กรอกรหัส Staff PIN 4-6 หลัก"]
    PromptPIN --> CheckPIN{"ตรวจสอบรหัส PIN"}
    CheckPIN -->|"ถูกต้อง"| Panel["เข้าสู่ Staff Control Panel"]
    CheckPIN -->|"ผิดเกิน 5 ครั้ง"| Lockout["ล็อกหน้าจอชั่วคราว 60 วินาที"]

    Panel --> SelectCommand{"เลือกคำสั่ง"}
    SelectCommand --> CmdReset["รีเซ็ตตู้กลับสู่หน้าแรกทันที"]
    SelectCommand --> CmdCam["สลับอุปกรณ์กล้อง หรือ Calibrate ท่ามือ"]
    SelectCommand --> CmdStats["ดูสถิติจำนวนคนถ่าย และสถานะ Cloud Sync"]
    SelectCommand --> CmdSync["สั่ง Force Sync อัปโหลดรูปที่ค้างในเครื่องตู้"]

    CmdReset --> StaffDone
    CmdCam --> StaffDone
    CmdStats --> StaffDone
    CmdSync --> StaffDone
```

### 3.3 Admin Flow: การทำลายข้อมูลอัตโนมัติ 7 วันตามมาตรฐาน PDPA

```mermaid
flowchart TD
    CronStart(["Cron Job ทำงานอัตโนมัติทุกวันเวลา 00:00 น."]) --> Query["ค้นหารูปภาพที่มี CreatedAt เกิน 7 วันในฐานข้อมูล"]
    Query --> CheckExpired{"พบรูปภาพที่หมดอายุหรือไม่"}

    CheckExpired -->|"ไม่พบ"| CronEnd(["สิ้นสุดรอบการตรวจสอบ"])
    CheckExpired -->|"พบรูปหมดอายุ"| DeleteCloud["ลบไฟล์ภาพต้นฉบับใน Cloudflare R2 Bucket"]

    DeleteCloud --> DeleteMeta["ลบรหัส Short Code OPH-XXXX ออกจาก Metadata Store"]
    DeleteMeta --> WriteLog["บันทึก RoPA Audit Log การลบทำลายข้อมูลตาม PDPA"]
    WriteLog --> CronEnd
```

---

## ส่วนที่ 4: ลำดับการทำงานของกระบวนการสำคัญ (Sequence Diagrams)

### 4.1 Sequence 01: Touchless Hand Gesture Capture & Countdown Loop

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
    UI->>Visitor: เล่นเสียง Beep + แสดงตัวเลข 5.. 4.. 3.. 2.. 1.. บนหน้าจอ
    UI->>Cam: สั่ง Freeze Frame ที่วินาทีที่ 0
    UI->>Visitor: แสดงเอฟเฟกต์แฟลชจอขาว (Flash 100ms)
    UI->>UI: เปลี่ยนสถานะเป็น SHOW_PREVIEW
```

### 4.2 Sequence 02: Image Capture, Preview & 5-8s Retake Logic

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
        UI->>Visitor: เริ่มนับถอยหลัง 5.. 4.. 3.. 2.. 1.. ถ่ายใหม่อีกครั้งทันที
    else ผู้ใช้ไม่กด หรือเวลานับถอยหลังหมดลง (Auto-Confirm)
        UI->>State: สิ้นสุดระยะเวลา Retake (CONFIRM_PHOTO)
        UI->>UI: เปลี่ยนสถานะเป็น GENERATING_QR
    end
```

### 4.3 Sequence 03: Storage Upload, Short Code & Clean QR Generation
การออกรหัสและแสดงผลเฉพาะ QR Code บนหน้าตู้:

```mermaid
sequenceDiagram
    autonumber
    participant UI as Kiosk Viewfinder UI
    participant CodeEngine as Short Code Engine
    participant LocalDB as Local Disk Buffer (SSD)
    participant SyncWorker as Background Sync Worker
    participant CloudAPI as Cloudflare R2 / Serverless API

    UI->>CodeEngine: ขอรหัสสั้นประจำรูปภาพ
    CodeEngine->>CodeEngine: สุ่มรหัส 4 หลักในฟอร์แมต OPH-XXXX (เช่น OPH-8K2P)
    CodeEngine-->>UI: ส่งคืนรหัส OPH-8K2P และ URL: https://booth.swu.ac.th/p/OPH-8K2P

    Note over UI: หน้าตู้แสดงเฉพาะ QR Code ขนาดใหญ่ (ไม่แสดงตัวอักษร OPH-XXXX บนหน้าจอ)
    UI->>UI: เรนเดอร์ QR Code ขนาดใหญ่บนจอ (< 200ms)
    UI->>UI: เริ่มนับถอยหลังหน้าจอ 15-20 วินาที + แสดงปุ่ม "เสร็จสิ้น / คนถัดไป"
    UI->>LocalDB: บันทึกภาพต้นฉบับ + Metadata (OPH-8K2P) ลงไดรฟ์เครื่องตู้

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

### 4.4 Sequence 04: Mobile Customization & Code Display
แสดงรหัส `OPH-XXXX` บนมือถือให้น้องเก็บไว้:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as ผู้ร่วมงาน (Visitor)
    participant Browser as Mobile Browser (iOS Safari / Chrome)
    participant CDN as Cloudflare Edge CDN / R2
    participant Canvas as HTML5 Canvas 2D Engine
    participant Gallery as Camera Roll / Gallery มือถือ

    Visitor->>Browser: สแกน QR Code เข้าสู่ https://booth.swu.ac.th/p/OPH-8K2P
    Browser->>CDN: ดึงภาพถ่ายต้นฉบับ 1080p
    CDN-->>Browser: ส่งคืนภาพถ่ายความละเอียดสูง
    
    Note over Visitor,Browser: หน้าเว็บบนมือถือแสดง Banner รหัส OPH-8K2P ให้น้องเก็บไว้
    Browser->>Visitor: แสดงหัวข้อ "รหัสภาพถ่ายของคุณ: OPH-8K2P (ดาวน์โหลดได้ใน 7 วัน)"
    Browser->>Canvas: โหลดภาพลงใน Offscreen Canvas

    Note over Visitor,Canvas: ขั้นตอนที่ 1: การแต่งสีภาพ (Color Grading)
    Visitor->>Browser: แตะเลือกฟิลเตอร์พรีเซ็ต (เช่น Rosy Bright) หรือเลื่อนปรับสว่าง
    Browser->>Canvas: คำนวณ Color Transform Matrix
    Canvas-->>Browser: อัปเดตภาพพรีวิวสดแบบเรียลไทม์ (Live Preview < 16ms)
    Visitor->>Browser: กดปุ่ม "ถัดไป: เลือกกรอบรูป"

    Note over Visitor,Canvas: ขั้นตอนที่ 2: การเลือก 1 ใน 3 กรอบรูป CPE SWU
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

### 4.5 Sequence 05: Staff Back-Office QR Re-Issue Flow (ระบบหลังบ้านสำหรับน้องมาขอ QR ทีหลัง)
กรณีผู้ใช้สแกนไม่ทันหรือลืมสแกน แล้วเดินมาหาสตาฟ:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as น้องผู้ร่วมงาน (ที่ลืมสแกน)
    actor Staff as สตาฟประจำบูท
    participant AdminApp as Staff Portal (/admin)
    participant API as /api/admin/photos
    participant Mobile as มือถือของน้อง

    Visitor->>Staff: "พี่คะ หนูเพิ่งถ่ายไปเมื่อ 14:32 น. ลืมสแกน QR ค่ะ"
    Staff->>AdminApp: เปิดหน้าแท็บ "Recent Captures Timeline" บนมือถือสตาฟ
    AdminApp->>API: เรียกดึงรายการรูปถ่ายล่าสุดตามเวลา (GET /api/admin/photos?limit=20)
    API-->>AdminApp: ส่งคืนรายการรูปภาพพร้อม Timestamp (14:32 น., 14:30 น., ...)
    
    Staff->>AdminApp: เลื่อนดูพรีวิวรูปภาพเวลา 14:32 น. และแตะเลือกรูปของน้อง
    AdminApp->>AdminApp: เปิด Modal ขยายภาพใหญ่ พร้อมสร้าง QR Code ของภาพนั้นทันที
    AdminApp->>Staff: แสดง QR Code และรหัส OPH-8K2P บนหน้าจอมือถือสตาฟ
    
    Staff->>Visitor: ยื่นหน้าจอให้: "สแกน QR ตรงนี้ได้เลยจ้า"
    Visitor->>Mobile: นำกล้องมือถือมาสแกน QR Code จากจอสตาฟ
    Mobile->>Mobile: เปิดหน้าเว็บ https://booth.swu.ac.th/p/OPH-8K2P
    Mobile->>Visitor: เข้าสู่หน้าแต่งภาพและดาวน์โหลดได้สำเร็จสมบูรณ์!
```

### 4.6 Sequence 06: Retroactive Photo Retrieval (`/find`)
การค้นหาภาพถ่ายย้อนหลังด้วยรหัส `OPH-XXXX` ผ่านหน้าค้นหา:

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as ผู้ร่วมงาน (Visitor)
    participant Web as Web Browser (/find)
    participant API as /api/photo/[code]
    participant KV as Short Code Metadata Store

    Visitor->>Web: เข้าเว็บ https://booth.swu.ac.th/find และพิมพ์รหัส "OPH-8K2P"
    Web->>API: ส่งคำขอ GET /api/photo/OPH-8K2P
    API->>KV: ค้นหารหัส OPH-8K2P

    alt รหัสถูกต้องและอายุภาพยังไม่เกิน 7 วัน
        KV-->>API: พบข้อมูล (CreatedAt: 2026-11-07, FilePath: photos/...)
        API-->>Web: ส่งคืนสถานะ 200 OK พร้อม CDN Image URL
        Web->>Visitor: เปิดหน้าจอแต่งภาพ /p/OPH-8K2P ให้เลือกกรอบและดาวน์โหลดได้ทันที
    else รหัสไม่ถูกต้อง หรือเกิน 7 วัน (ถูกลบตาม PDPA แล้ว)
        KV-->>API: ไม่พบข้อมูล หรือข้อมูลหมดอายุแล้ว
        API-->>Web: ส่งคืนสถานะ 404 Not Found
        Web->>Visitor: แสดงข้อความแจ้งเตือน "ไม่พบรหัสภาพ หรือภาพถ่ายหมดอายุแล้ว (เกิน 7 วัน)"
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
| **5. สแกน QR ไม่ทันใน 15 วินาที** | หน้าจอตู้รีเซ็ตกลับหน้าแรกแล้ว | สื่อสารให้น้องเดินไปขอ QR จากสตาฟได้ | สตาฟเปิดหน้า `/admin` ดึงรูปตามเวลาขึ้นมาให้น้องสแกน QR ใหม่ได้ทันที |
