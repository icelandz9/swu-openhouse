# Deploy ขึ้นอินเทอร์เน็ต (Vercel + Cloudflare R2)

เมื่อ deploy แล้ว ตัวเว็บและ API จะอยู่บน **Vercel** ส่วนไฟล์รูปอยู่บน **Cloudflare R2** มือถือเปิดรูปได้จากเน็ตไหนก็ได้ (4G/5G/Wi-Fi) และเปิดได้แม้คอมตู้จะปิดไปแล้ว

```
คอมตู้ (/kiosk, /display)   มือถือ (/p/OPH-XXXX)   สตาฟ (/admin)
             └──────────── https://<ชื่อโปรเจกต์>.vercel.app ────────────┘
                                     │
                         Cloudflare R2 (bucket แบบ private)
```

ทั้งสองบริการใช้ฟรีได้สำหรับงานขนาดนี้ R2 ให้พื้นที่ฟรี 10 GB และไม่คิดค่าโหลดรูป ส่วนรูป 2,000 รูปใช้พื้นที่ประมาณ 1.2 GB

## สิ่งที่ต้องมี

- บัญชี [GitHub](https://github.com) ที่เข้าถึง repo นี้ได้
- บัญชี [Vercel](https://vercel.com) (สมัครด้วย GitHub ได้)
- บัญชี [Cloudflare](https://dash.cloudflare.com) (การเปิดใช้ R2 ต้องผูกบัตร แต่ถ้าไม่เกินโควตาฟรีจะไม่ถูกเก็บเงิน)

## ขั้นที่ 1 — สร้าง bucket บน Cloudflare R2

1. Cloudflare Dashboard → **R2 Object Storage** → **Create bucket** ตั้งชื่อ `swu-photobooth` **ไม่ต้องเปิด Public access** เพราะมือถือจะโหลดรูปผ่านเว็บของเราด้วยรหัสของรูปนั้นเท่านั้น
2. เปิด bucket → **Settings** → **Object lifecycle rules** → **Add rule** ให้ลบ object เมื่ออายุครบ **7 วัน** (ตามกติกา PDPA) ตัวเว็บไม่แสดงรูปที่เกิน 7 วันอยู่แล้ว กฎนี้ทำให้ไฟล์ถูกลบจริง
3. R2 → **Manage R2 API Tokens** → **Create API token**
   - Permissions: **Object Read & Write**
   - Specify bucket: เลือก `swu-photobooth`
   - กดสร้างแล้วจด **Access Key ID** กับ **Secret Access Key** ไว้ทันที เพราะ Secret จะแสดงแค่ครั้งเดียว
4. จด **Account ID** จากหน้า R2 Overview (ด้านขวา)

### ทดสอบ R2 จากเครื่องตัวเอง (แนะนำ)

ใส่ค่าใน `web/.env.local`:

```
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=swu-photobooth
```

แล้วรันจาก root ของ repo:

```powershell
node web/scripts/test-r2-connection.mjs
```

ต้องขึ้น ✓ ครบทั้ง upload, download, list และ delete

## ขั้นที่ 2 — เตรียมรหัสสำหรับสตาฟ

หน้า `/kiosk`, `/display` และ `/admin` ต้องปลดล็อกด้วย PIN ก่อนใช้งาน และ API ที่ดูรายชื่อรูปหรือลบรูปได้ใช้ได้เฉพาะเบราว์เซอร์ที่ปลดล็อกแล้ว

- **`ADMIN_PIN`**: ตั้ง PIN ใหม่ **อย่างน้อย 6 หลัก** ห้ามใช้ `1234` เพราะเว็บเปิดสู่อินเทอร์เน็ต
- **`AUTH_SECRET`**: ค่าสุ่มสำหรับเซ็นคุกกี้ สร้างด้วยคำสั่ง:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## ขั้นที่ 3 — สร้างโปรเจกต์บน Vercel

1. Vercel → **Add New… → Project** → เลือก repo `swu-openhouse` → **Import**
2. **Root Directory**: กด Edit แล้วเลือก **`web`** (สำคัญ เพราะตัวเว็บอยู่ในโฟลเดอร์นี้)
3. Framework Preset จะเป็น **Next.js** เอง ไม่ต้องแก้คำสั่ง build
4. เปิด **Environment Variables** แล้วใส่:

   | Key | Value |
   |---|---|
   | `STORAGE_DRIVER` | `r2` |
   | `R2_ACCOUNT_ID` | จากขั้นที่ 1 |
   | `R2_ACCESS_KEY_ID` | จากขั้นที่ 1 |
   | `R2_SECRET_ACCESS_KEY` | จากขั้นที่ 1 |
   | `R2_BUCKET_NAME` | `swu-photobooth` |
   | `ADMIN_PIN` | จากขั้นที่ 2 |
   | `AUTH_SECRET` | จากขั้นที่ 2 |

   `NEXT_PUBLIC_APP_URL` ไม่ต้องใส่ QR จะใช้ที่อยู่ของเว็บที่เปิดอยู่
5. กด **Deploy** รอประมาณ 1–2 นาที ระหว่าง build ระบบจะโหลดโมเดลจับมือของ MediaPipe เอง
6. ได้ลิงก์ `https://<ชื่อโปรเจกต์>.vercel.app`

หลังจากนี้ทุกครั้งที่ merge เข้า `main` Vercel จะ deploy ใหม่ให้เอง ส่วน branch อื่นจะได้ลิงก์ preview แยก

## ขั้นที่ 4 — ทดสอบก่อนวันงาน

1. เปิด `https://<ชื่อโปรเจกต์>.vercel.app/admin` กรอก PIN ควรเข้าแดชบอร์ดได้
2. เปิด `/kiosk` และ `/display` **ในเบราว์เซอร์เดียวกันบนคอมตู้** เบราว์เซอร์ที่ปลดล็อกแล้วจะเปิดได้ทุกแท็บโดยไม่ต้องกรอก PIN ซ้ำ จากนั้นอนุญาตให้ใช้กล้อง
3. แบมือถ่าย 1 รูป แล้วสแกน QR บนจอด้วยมือถือที่ใช้ **4G** (ปิด Wi-Fi) ควรเปิดหน้าแต่งรูปและเห็นรูปได้
4. ใน `/admin` ลองลบรูปนั้น แล้วเปิดลิงก์เดิมบนมือถือ ต้องไม่เห็นรูปแล้ว
5. เปิด `https://<ชื่อโปรเจกต์>.vercel.app/api/photos` ในหน้าต่างไม่ระบุตัวตน (Incognito) ต้องได้ `401` แปลว่าคนนอกดูรายชื่อรูปไม่ได้

## ใช้งานในวันงาน

- คอมตู้ต้องต่ออินเทอร์เน็ตตลอด รูปจะอัปโหลดขึ้น R2 ทันทีที่ถ่าย
- เปิด `/kiosk` และ `/display` เต็มจอ (`F11`) บนคอมตู้ในเบราว์เซอร์เดียวกัน
- คุกกี้ของสตาฟมีอายุ 3 วัน ถ้าหมดอายุให้กรอก PIN ใหม่
- `/admin` เปิดบนเครื่องอื่นได้ เช่น ดูรูปหรือลบรูป แต่ปุ่มสั่งงานตู้ (รีเซ็ต, หยุดตู้) ยังส่งถึงตู้ได้เฉพาะเมื่อเปิดในเบราว์เซอร์เดียวกับตู้

## รันในเครื่องเหมือนเดิม

ถ้าไม่ตั้ง `STORAGE_DRIVER=r2` ระบบจะเก็บรูปใน `web/data/` เหมือนเดิม PIN ในเครื่องคือ `1234` ถ้าไม่ได้ตั้ง `ADMIN_PIN` ไว้

## แก้ปัญหา

| อาการ | วิธีแก้ |
|---|---|
| หน้าปลดล็อกขึ้น "ยังไม่ได้ตั้งค่า ADMIN_PIN" หรือ "AUTH_SECRET" | ใส่ค่าใน Vercel → Settings → Environment Variables แล้วกด **Redeploy** |
| ถ่ายรูปแล้ว QR เปิดไม่เจอรูป | ดู Vercel → Logs ถ้าเจอ `R2 upload failed` ให้ตรวจ R2 key และชื่อ bucket หรือรัน `test-r2-connection.mjs` |
| Log ขึ้น "On Vercel, photos must go to Cloudflare R2" | ยังไม่ได้ตั้ง `STORAGE_DRIVER=r2` หรือ R2 key บน Vercel |
| Build บน Vercel ล้มที่ `setup-assets` | โหลดโมเดลจับมือไม่ได้ชั่วคราว กด Redeploy |
