const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  AlignmentType,
  PageNumber,
} = require('docx');

const FONT_FAMILY = "TH Sarabun PSK";

const equipmentData = [
  ["1", "คอมพิวเตอร์ / โน้ตบุ๊ก Kiosk (Screen 1)", "1 เครื่อง"],
  ["2", "กล้อง WebCam Full HD 1080p", "1 ตัว"],
  ["3", "ขาตั้งกล้อง (Tripod)", "1 ชุด"],
  ["4", "ชุดไฟส่องสว่าง LED Softbox / Ring Light", "1–2 ตัว"],
  ["5", "เมาส์และคีย์บอร์ด", "1 ชุด"],
  ["6", "สมาร์ททีวี / จอมอนิเตอร์ใหญ่ 50–65 นิ้ว (Screen 2)", "1 เครื่อง"],
  ["7", "ขาตั้งทีวีล้อเลื่อน", "1 ชุด"],
  ["8", "สายสัญญาณ HDMI (3–5 เมตร)", "2 เส้น"],
  ["9", "ตัวแปลงสัญญาณจอภาพ (Type-C to HDMI)", "1–2 ตัว"],
  ["10", "โน้ตบุ๊ก / แท็บเล็ต สำหรับสตาฟฟ์ Admin", "1–2 เครื่อง"],
  ["11", "โต๊ะและเก้าอี้ควบคุมสตาฟฟ์", "1 ชุด"],
  ["12", "เราเตอร์ 5G CPE (พร้อมซิมเน็ต)", "1 เครื่อง"],
  ["13", "Pocket WiFi / ซิมสำรอง", "1 ชุด"],
  ["14", "สาย LAN CAT6", "3 เส้น"],
  ["15", "ปลั๊กพ่วง มอก. (สายหนา 4–6 ช่อง)", "3 ราง"],
  ["16", "เทปผ้ากาวยึดสายไฟกับพื้น (Gaffer Tape)", "2 ม้วน"],
  ["17", "พัดลมระบายความร้อนขนาดเล็ก", "1–2 ตัว"],
  ["18", "เสากั้นทางเดิน / สายดึงกั้นคิว", "2–4 เสา"],
  ["19", "สติกเกอร์ติดพื้นจุดยืนถ่ายรูป", "2 จุด"],
  ["20", "ป้าย X-Stand แนะนำวิธีใช้งาน", "1 ป้าย"],
  ["21", "ป้ายแจ้งเตือน PDPA Notice", "1 แผ่น"],
  ["22", "กล่องพร็อพถ่ายรูป (ป้ายคำพูด / แว่นตา / ป้ายเกียร์)", "1 กล่อง"],
  ["23", "ชุดทำความสะอาด (ผ้าเช็ดเลนส์ / แอลกอฮอล์)", "1 ชุด"],
];

async function generateDocx() {
  const listParagraphs = equipmentData.map((row) => {
    return new Paragraph({
      spacing: { line: 300, before: 60, after: 60 },
      children: [
        new TextRun({
          text: `${row[0]}. ${row[1]}`,
          font: FONT_FAMILY,
          size: 32, // 16pt
          color: "0F172A",
        }),
        new TextRun({
          text: "  :  ",
          font: FONT_FAMILY,
          size: 32,
          bold: true,
          color: "64748B",
        }),
        new TextRun({
          text: row[2],
          font: FONT_FAMILY,
          size: 32,
          bold: true,
          color: "CE1126",
        }),
      ],
    });
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: 32, // 16pt default body
            color: "0F172A",
          },
          paragraph: {
            spacing: { line: 290, after: 120 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4
              height: 16838,
            },
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { line: 240 },
                children: [
                  new TextRun({
                    text: "ภาควิชาวิศวกรรมคอมพิวเตอร์ คณะวิศวกรรมศาสตร์ มศว | CPE SWU Open House 2026",
                    font: FONT_FAMILY,
                    size: 24, // 12pt
                    color: "64748B",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { line: 240 },
                children: [
                  new TextRun({
                    text: "รายการอุปกรณ์และจำนวนหน้างาน (ฟอนต์ TH Sarabun PSK 16pt) | หน้า ",
                    font: FONT_FAMILY,
                    size: 24,
                    color: "64748B",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_FAMILY,
                    size: 24,
                    color: "64748B",
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 80, line: 320 },
            children: [
              new TextRun({
                text: "รายการอุปกรณ์และจำนวนที่ต้องใช้หน้างาน",
                bold: true,
                color: "CE1126",
                font: FONT_FAMILY,
                size: 40, // 20pt
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240, line: 300 },
            children: [
              new TextRun({
                text: "โครงการบูธกิจกรรม SWU PhotoBooth งานเปิดบ้าน มศว (SWU Open House 2026)\nภาควิชาวิศวกรรมคอมพิวเตอร์ คณะวิศวกรรมศาสตร์ มหาวิทยาลัยศรีนครินทรวิโรฒ",
                bold: true,
                color: "1E293B",
                font: FONT_FAMILY,
                size: 32, // 16pt
              }),
            ],
          }),

          // Thin decorative separator
          new Paragraph({
            border: {
              bottom: {
                style: "single",
                size: 6,
                color: "CE1126",
                space: 1,
              },
            },
            spacing: { after: 200 },
          }),

          // Equipment List Items (No Table)
          ...listParagraphs,

          new Paragraph({
            spacing: { before: 360, after: 120 },
          }),

          // Signatures (No Table)
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { line: 280, before: 120, after: 60 },
            children: [
              new TextRun({ text: "ลงชื่อ....................................................................ผู้จัดเตรียม           ลงชื่อ....................................................................ผู้ตรวจรับ", font: FONT_FAMILY, size: 30 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { line: 280, before: 40, after: 60 },
            children: [
              new TextRun({ text: "    (....................................................................)                       (....................................................................)", font: FONT_FAMILY, size: 30 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { line: 280, before: 40, after: 60 },
            children: [
              new TextRun({ text: "วันที่ ...... / ...... / 2569                                                       วันที่ ...... / ...... / 2569", font: FONT_FAMILY, size: 28, color: "64748B" }),
            ],
          }),
        ],
      },
    ],
  });

  const outputPath = path.join(__dirname, '..', 'docs', 'CPE_SWU_OPENHOUSE_EQUIPMENT_LIST.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`EQUIPMENT_LIST_NO_TABLE_DOCX_GENERATED: ${outputPath}`);
}

generateDocx().catch((err) => {
  console.error("GENERATION_FAILED:", err);
  process.exit(1);
});
