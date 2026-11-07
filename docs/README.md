# เอกสารโครงการ (Documentation Index)

เริ่มอ่านจาก **[มติล่าสุด](decisions.md)** — สรุปค่าที่ใช้จริงทั้งหมดไว้หน้าเดียว

| เอกสาร | เนื้อหา |
|---|---|
| [decisions.md](decisions.md) | มติล่าสุดของระบบ + บันทึกการแก้ไขมติ |
| [system-overview.md](system-overview.md) | ไดอะแกรมภาพรวมระบบและขั้นตอนการใช้งาน |
| [backlog.md](backlog.md) | แผนงาน Task 00–11 และมาตรฐานเอกสาร |

## Task 00 — Discovery & Sizing

| เอกสาร | เนื้อหา |
|---|---|
| [discovery-and-sizing.md](task00-discovery/discovery-and-sizing.md) | ADR-01 ถึง 10, ข้อกำหนดเบื้องต้น, งบประมาณ BOM/BOQ, เกณฑ์ตรวจรับ AC-01 ถึง 10 |
| [qa-decisions.md](task00-discovery/qa-decisions.md) | บันทึกถาม-ตอบ 11 ข้อ |

## Task 01 — Requirements

| เอกสาร | เนื้อหา |
|---|---|
| [requirements-specification.md](task01-requirements/requirements-specification.md) | BRD, PRD, SRS (FR-01 ถึง 12), NFR, RTM |
| [architecture-and-sequence-flow.md](task01-requirements/architecture-and-sequence-flow.md) | C4, State Machine, User Flow, Sequence Diagram, Fault Matrix |
| [qa-decisions.md](task01-requirements/qa-decisions.md) | บันทึกถาม-ตอบ 8 ข้อ |

## Task 02 — Architecture & Technical Design

| เอกสาร | เนื้อหา |
|---|---|
| [system-architecture-and-technical-design.md](task02-architecture/system-architecture-and-technical-design.md) | C4, Kiosk FSM, Vision Pipeline, Canvas Compositor, Staff Portal, ADR-01 ถึง 08 |
| [team-execution-and-github-plan.md](task02-architecture/team-execution-and-github-plan.md) | แผนการแบ่งงาน 3 คน, ลำดับการรวมโค้ดเข้า main (Milestone 10 พ.ย. และ 12 พ.ย.), และคู่มือ Git Flow |
| [project-structure-and-clean-architecture-guide.md](task02-architecture/project-structure-and-clean-architecture-guide.md) | สถาปัตยกรรม 4-Layer Pragmatic Feature-Driven, ADR-09, Ports & Adapters, และโครงสร้าง web/ |
| [qa-decisions.md](task02-architecture/qa-decisions.md) | บันทึกถาม-ตอบ 14 ข้อ (ครอบคลุมสถาปัตยกรรม 2 จอแสดงผล + 1 Laptop) |

## หมายเหตุ

- บันทึก Q&A (`qa-decisions.md`) เก็บคำตอบ ณ วันที่ถามไว้เป็นประวัติ ถ้ามติเปลี่ยนภายหลัง จะบันทึกไว้ใน [decisions.md](decisions.md)
- ตรวจไดอะแกรม Mermaid ทุกไฟล์ด้วย `node poc/validate_mermaid.mjs` (รันจาก root ของ repo)
