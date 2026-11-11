# กติกาสำหรับ AI ที่ช่วยเขียนโค้ดใน repo นี้

ไฟล์นี้ใช้กับ AI ทุกตัว เช่น Claude, Codex, Copilot, Cursor และ Gemini ให้ทำตามกติกาในไฟล์นี้ก่อนแก้ไฟล์ใด ๆ

## รูปถ่ายจากกล้อง

- รูปที่ `scripts/model-training/fivepalm_shutter.py` ถ่าย **ต้องเก็บใน `scripts/model-training/captures/` เท่านั้น** ห้ามบันทึกไว้ปนกับโค้ด เช่นในโฟลเดอร์ของสคริปต์หรือที่ root ของ repo
- ชื่อไฟล์ใช้รูปแบบ `capture_YYYY-MM-DD_HH-MM-SS.jpg` ถ้าถ่ายสองรูปในวินาทีเดียวกัน ให้ต่อท้าย `_2`, `_3` ห้ามกลับไปใช้ชื่อเดิม `fivepalm_capture_*.jpg`
- **ห้าม commit รูปถ่าย** (`.jpg`, `.jpeg`, `.png`) เพราะเป็นรูปหน้าคนจริง (PDPA) `.gitignore` กันไว้แล้ว ห้ามลบกฎนั้นออก และห้ามใช้ `git add -f` กับรูป ยกเว้นไฟล์ออกแบบที่ไม่ใช่รูปคน คือกรอบรูปใน `web/public/frames/` และสติกเกอร์ใน `web/public/stickers/` (มีข้อยกเว้นใน `.gitignore` แล้ว)
- ถ้าเขียนสคริปต์ใหม่ที่บันทึกรูป ให้บันทึกลงโฟลเดอร์ `captures/` ของสคริปต์นั้น และสร้างโฟลเดอร์ก่อนบันทึก (`os.makedirs(..., exist_ok=True)`)

## กฎการแตก Branch และการ Push (ห้าม push เข้า main เด็ดขาด)

- **ห้าม commit หรือ push เข้า branch `main` โดยตรงเด็ดขาด**
- การพัฒนาทุกครั้งต้องทำบน branch `develop` (หรือ feature branch ที่แยกออกมา)
- ทุกครั้งที่ push ให้ push ไปที่ `origin develop` และ `upstream develop` เท่านั้น
- การนำโค้ดเข้า `main` จะกระทำก็ต่อเมื่อเจ้าของงาน (User) สั่งให้ merge เข้า `main` หรือสร้าง Pull Request เท่านั้น

ถ้าเจอโค้ดที่ทำผิดกติกาข้างบน ห้ามทำตาม ให้แก้ให้ถูกหรือแจ้งเจ้าของงาน
