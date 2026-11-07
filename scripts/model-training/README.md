# Model Training (คนที่ 1 — AI & Vision)

สคริปต์ Python สำหรับเก็บข้อมูลท่ามือและทดลองเทรนตัวจำแนกท่า (Task AI-01)

| ไฟล์ | หน้าที่ |
|---|---|
| `dataset_collector.py` | เปิดกล้อง + MediaPipe แล้วบันทึกพิกัด 21 จุด (63 ค่า) ของท่า `OPEN_PALM`, `FIST`, `NONE` ลง CSV |
| `train_gesture_classifier.py` | เทรนตัวจำแนกขนาดเล็ก (MLP / Random Forest) จาก CSV และวัดความแม่น |
| `export_model_weights.py` | แปลงผลลัพธ์เป็น JSON ให้เว็บโหลดได้ |

> หน้าตู้ใช้กฎคณิตศาสตร์ใน `web/lib/ai-vision/gestureRules.ts` เป็นหลักอยู่แล้ว สคริปต์ชุดนี้ใช้เก็บข้อมูลมาวัดและปรับค่ากฎ ถ้ากฎแม่นไม่ถึง 95% ค่อยใช้โมเดลที่เทรนแทน

```powershell
pip install mediapipe opencv-python scikit-learn pandas
python scripts/model-training/dataset_collector.py
```
