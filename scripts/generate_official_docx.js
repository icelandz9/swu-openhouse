const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageNumber,
  PageBreak,
  LevelFormat,
} = require('docx');

// Dimensions in DXA (1440 DXA = 1 inch)
// A4 = 11906 x 16838 DXA. Margins = 1440 DXA. Content Width = 9026 DXA.
const CONTENT_WIDTH = 9026;
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };
const TABLE_BORDERS = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
};

const FONT_FAMILY = "TH Sarabun New";

function makeHeaderCell(text, width, bgColor = "CE1126") {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: bgColor, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    borders: TABLE_BORDERS,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            bold: true,
            color: "FFFFFF",
            font: FONT_FAMILY,
            size: 24, // 12pt
          }),
        ],
      }),
    ],
  });
}

function makeCell(text, width, align = AlignmentType.LEFT, bold = false, fill = "FFFFFF", textColor = "1E293B") {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    borders: TABLE_BORDERS,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            bold,
            color: textColor,
            font: FONT_FAMILY,
            size: 24, // 12pt
          }),
        ],
      }),
    ],
  });
}

function createHeading1(text) {
  return new Paragraph({
    spacing: { before: 320, after: 160 },
    children: [
      new TextRun({
        text,
        bold: true,
        color: "CE1126",
        font: FONT_FAMILY,
        size: 32, // 16pt
      }),
    ],
  });
}

function createHeading2(text) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        color: "0F172A",
        font: FONT_FAMILY,
        size: 28, // 14pt
      }),
    ],
  });
}

function createParagraph(text, isBold = false) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({
        text,
        bold: isBold,
        color: "334155",
        font: FONT_FAMILY,
        size: 24, // 12pt
      }),
    ],
  });
}

// 1. Equipment Inventory Items
const equipmentSection1 = [
  ["1.1", "คอมพิวเตอร์ / โน้ตบุ๊ก Kiosk", "Core i5 / Ryzen 5+, RAM 8GB+, SSD, มีพอร์ต USB 3.0 & HDMI", "1 เครื่อง", "ฝ่ายเทคนิค"],
  ["1.2", "กล้อง WebCam Full HD", "1080p @ 60fps (Logitech C920/C922 หรือเทียบเท่า) โฟกัสเร็ว", "1 ตัว", "ฝ่ายเทคนิค"],
  ["1.3", "ขาตั้งกล้องมั่นคง (Tripod)", "ปรับระดับความสูง 1.2 - 1.7 ม. ฐานเหล็กรับแรง ไม่สั่นไหว", "1 ชุด", "ฝ่ายสถานที่"],
  ["1.4", "ชุดไฟส่องสว่าง LED Softbox", "ไฟ LED ปรับอุณหภูมิสีได้ เพื่อลดเงาฝ่ามือ ให้ AI ตรวจจับแม่นยำ", "1-2 ตัว", "ฝ่ายสถานที่"],
  ["1.5", "เมาส์ & คีย์บอร์ดฉุกเฉิน", "สำหรับสตาฟฟ์พิมพ์หรือกดคีย์ลัด [1]-[4] กรณีจำเป็น", "1 ชุด", "ฝ่ายเทคนิค"],
];

const equipmentSection2 = [
  ["2.1", "สมาร์ททีวี / มอนิเตอร์ใหญ่", "ขนาด 50 - 65 นิ้วขึ้นไป Full HD/4K ความสว่างสูง สีสดใส", "1 เครื่อง", "ฝ่ายสถานที่"],
  ["2.2", "ขาตั้งทีวีล้อเลื่อน (TV Stand)", "ขาตั้งเหล็กมีล้อล็อกได้ ปรับระดับสายตาผู้เดินผ่าน", "1 ชุด", "ฝ่ายสถานที่"],
  ["2.3", "สายสัญญาณภาพ HDMI 2.0", "ความยาว 3 - 5 เมตร รองรับ 1080p 60Hz สัญญาณคมชัด", "2 เส้น", "ฝ่ายเทคนิค"],
  ["2.4", "ตัวแปลงสัญญาณจอภาพ", "Type-C to HDMI / Mini-DP ตามพอร์ตโน้ตบุ๊กที่ใช้งาน", "1-2 ตัว", "ฝ่ายเทคนิค"],
];

const equipmentSection3 = [
  ["3.1", "โน้ตบุ๊ก / iPad สตาฟฟ์ Admin", "สำหรับเปิดหน้า /admin เฝ้าระวังจอใหญ่, คุมชัตเตอร์, ดู Log", "1-2 เครื่อง", "สตาฟฟ์เวร"],
  ["3.2", "โต๊ะ-เก้าอี้ศูนย์บัญชาการ", "โต๊ะทำงานขนาดกะทัดรัด เก้าอี้ 2 ตัว วางไม่บังมุมกล้อง", "1 ชุด", "ฝ่ายสถานที่"],
];

const equipmentSection4 = [
  ["4.1", "เราเตอร์ 5G CPE (Wi-Fi 6)", "รองรับคลื่น 5GHz + ซิม Unlimited 5G ไม่ลดสปีด สำหรับออกเน็ต", "1 เครื่อง", "ฝ่ายเครือข่าย"],
  ["4.2", "Pocket WiFi / ซิมสำรอง", "ค่ายสำรอง (เช่น AIS / True) สำหรับทำ Failover เมื่อเน็ตหลักสะดุด", "1 ชุด", "ฝ่ายเครือข่าย"],
  ["4.3", "สาย LAN CAT6 ความเร็วสูง", "ความยาว 5 ม. และ 10 ม. ต่อตรง Kiosk PC และ Admin ลด Latency", "3 เส้น", "ฝ่ายเครือข่าย"],
  ["4.4", "ปลั๊กพ่วง มอก. สายหนา", "Surge Protector ป้องกันไฟกระชาก 4-6 ช่อง (ยาว 5-10 ม.)", "3 ราง", "ฝ่ายสถานที่"],
  ["4.5", "เทปผ้ากาวยึดสาย (Gaffer Tape)", "เทปผ้าสีดำ/สีสะท้อนแสง ยึดสายไฟและสาย LAN กับพื้นกันสะดุด", "2 ม้วน", "ฝ่ายสถานที่"],
  ["4.6", "พัดลมระบายความร้อนขนาดเล็ก", "พัดลมตั้งโต๊ะเป่าระบายความร้อนหลังโน้ตบุ๊กและทีวีที่เปิดทั้งวัน", "1-2 ตัว", "ฝ่ายสถานที่"],
];

const equipmentSection5 = [
  ["5.1", "เสากั้นทางเดิน / สายดึงกั้นคิว", "เสาสแตนเลสสายดึงยืดหดได้ จัดระเบียบทางเข้าและทางออก", "2-4 เสา", "ฝ่ายสถานที่"],
  ["5.2", "สติกเกอร์จุดยืนถ่ายรูป", "สติกเกอร์แปะพื้นระบุ 'จุดยืนถ่ายรูป (1.8 ม.)' ชัดเจน", "2 จุด", "ฝ่ายสถานที่"],
  ["5.3", "ป้าย X-Stand แนะนำการใช้งาน", "ป้ายขั้นตอน: 1. แบมือ 5 นิ้ว 2. ยิ้มนับ 3 วิ 3. สแกน QR ที่จอใหญ่", "1 ป้าย", "ฝ่ายสื่อ/ศิลป์"],
  ["5.4", "ป้าย PDPA Privacy Notice", "ป้ายแจ้งการลบภาพอัตโนมัติภายใน 7 วัน และสิทธิขอถอนภาพ", "1 แผ่น", "ฝ่ายกฎหมาย/ประสานงาน"],
  ["5.5", "พร็อพถ่ายรูป (Props)", "ป้ายคำพูดสไตล์เด็กคอมฯ, แว่นตาแฟนซี, ป้ายเกียร์ CPE SWU", "1 กล่อง", "ฝ่ายสันทนาการ"],
  ["5.6", "อุปกรณ์ทำความสะอาด", "ผ้าไมโครไฟเบอร์เช็ดหน้าเลนส์, สเปรย์แอลกอฮอล์, ทิชชู่เปียก", "1 ชุด", "ฝ่ายสถานที่"],
];

function buildEquipmentTable(data) {
  const colWidths = [800, 2200, 3726, 1000, 1300];
  const headerRow = new TableRow({
    children: [
      makeHeaderCell("ลำดับ", colWidths[0]),
      makeHeaderCell("รายการอุปกรณ์", colWidths[1]),
      makeHeaderCell("สเปก / รายละเอียดคุณสมบัติ", colWidths[2]),
      makeHeaderCell("จำนวน", colWidths[3]),
      makeHeaderCell("ผู้รับผิดชอบ", colWidths[4]),
    ],
  });

  const bodyRows = data.map((row, idx) => {
    const fill = idx % 2 === 1 ? "F8FAFC" : "FFFFFF";
    return new TableRow({
      children: [
        makeCell(row[0], colWidths[0], AlignmentType.CENTER, false, fill),
        makeCell(row[1], colWidths[1], AlignmentType.LEFT, true, fill),
        makeCell(row[2], colWidths[2], AlignmentType.LEFT, false, fill),
        makeCell(row[3], colWidths[3], AlignmentType.CENTER, false, fill),
        makeCell(row[4], colWidths[4], AlignmentType.CENTER, false, fill),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...bodyRows],
  });
}

// 4-Shift Table
function build4ShiftTable() {
  const colWidths = [1500, 1800, 1500, 4226];
  const headerRow = new TableRow({
    children: [
      makeHeaderCell("ผลัดที่", colWidths[0]),
      makeHeaderCell("ช่วงเวลา", colWidths[1]),
      makeHeaderCell("จำนวนกำลังพล", colWidths[2]),
      makeHeaderCell("รายละเอียดการปฏิบัติหน้าที่และสถานการณ์", colWidths[3]),
    ],
  });

  const data = [
    [
      "Shift 1\n(Morning Launch)",
      "08:30 – 10:45 น.\n(2 ชม. 15 นาที)",
      "3 – 4 คน",
      "ช่วงเปิดงาน คนเริ่มทยอยเข้าบูธ ตรวจสอบความพร้อมระบบ Kiosk, Showcase และทดสอบสปีดเน็ต Role 1-4 ประจำจุดละ 1 คน",
    ],
    [
      "Shift 2\n(Peak Rush Noon)",
      "10:45 – 13:00 น.\n(2 ชม. 15 นาที)",
      "4 – 5 คน\n(เสริมทัพ)",
      "ช่วงพีคสูงสุด ผู้เข้าร่วมงานต่อคิวยาวหนาแน่น เสริมกำลังพล Role 3 (คุมแถว) เป็น 2 คน สตาฟฟ์ Admin ใช้โหมดนับถอยหลัง 3 วินาทีเร่งระบายคิว",
    ],
    [
      "Shift 3\n(Afternoon Energy)",
      "13:00 – 15:15 น.\n(2 ชม. 15 นาที)",
      "4 คน",
      "ช่วงบ่าย มีกิจกรรมและเวทีใหญ่ คนไหลเวียนต่อเนื่อง สตาฟฟ์ Role 1-4 สับเปลี่ยนตำแหน่งภายในผลัดเพื่อลดความเมื่อยล้า",
    ],
    [
      "Shift 4\n(Finale & Tear-down)",
      "15:15 – 17:30 น.\n(2 ชม. 15 นาที)",
      "4 คน\n(+ ทุกคนตอนเก็บ)",
      "ช่วงท้ายงานและปิดรับคิวถ่ายรูป เวลา 17:00 น. เริ่มกระบวนการ Shutdown ระบบ เคลียร์ขยะ ม้วนเก็บสายไฟ และตรวจนับอุปกรณ์ตาม Checklist",
    ],
  ];

  const bodyRows = data.map((row, idx) => {
    const fill = idx % 2 === 1 ? "F8FAFC" : "FFFFFF";
    return new TableRow({
      children: [
        makeCell(row[0], colWidths[0], AlignmentType.CENTER, true, fill),
        makeCell(row[1], colWidths[1], AlignmentType.CENTER, false, fill),
        makeCell(row[2], colWidths[2], AlignmentType.CENTER, true, fill),
        makeCell(row[3], colWidths[3], AlignmentType.LEFT, false, fill),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...bodyRows],
  });
}

// 2-Shift Table
function build2ShiftTable() {
  const colWidths = [1800, 2000, 1600, 3626];
  const headerRow = new TableRow({
    children: [
      makeHeaderCell("ผลัดที่", colWidths[0]),
      makeHeaderCell("ช่วงเวลาปฏิบัติงาน", colWidths[1]),
      makeHeaderCell("ทีมที่รับผิดชอบ", colWidths[2]),
      makeHeaderCell("แผนการจัดสรรเวลาและการพักผ่อน (Micro-Break)", colWidths[3]),
    ],
  });

  const data = [
    [
      "Shift A\n(ผลัดเช้า)",
      "08:30 – 13:00 น.\n(4 ชม. 30 นาที)",
      "Team A\n(3 – 4 คน)",
      "• 08:00 – 08:30: ติดตั้งอุปกรณ์และทดสอบ Run-up Checklist\n• 08:30 – 11:30: ปฏิบัติหน้าที่เต็มกำลัง Role 1–4\n• 11:30 – 12:30: สลับกันไปรับประทานอาหารกลางวันรอบละ 2 คน (คนละ 30 นาที ห้ามทิ้งตู้ว่าง)\n• 12:45 – 13:00: ส่งมอบงานและสรุปสถานะให้ Team B",
    ],
    [
      "Shift B\n(ผลัดบ่าย)",
      "12:45 – 17:30 น.\n(4 ชม. 45 นาที)",
      "Team B\n(3 – 4 คน)",
      "• 12:45 – 13:00: รับมอบเวร เช็คเลนส์กล้องและสถานะเครือข่าย\n• 13:00 – 15:00: รับมือทราฟฟิกช่วงบ่าย คนแน่นต่อเนื่อง\n• 15:00 – 16:00: หมุนเวียนพักย่อยดื่มน้ำ/เข้าห้องน้ำคนละ 15-20 นาที\n• 17:00 – 17:30: ยุติการถ่าย ปิดระบบ และเก็บอุปกรณ์ (Tear-down)",
    ],
  ];

  const bodyRows = data.map((row, idx) => {
    const fill = idx % 2 === 1 ? "F8FAFC" : "FFFFFF";
    return new TableRow({
      children: [
        makeCell(row[0], colWidths[0], AlignmentType.CENTER, true, fill),
        makeCell(row[1], colWidths[1], AlignmentType.CENTER, false, fill),
        makeCell(row[2], colWidths[2], AlignmentType.CENTER, true, fill),
        makeCell(row[3], colWidths[3], AlignmentType.LEFT, false, fill),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...bodyRows],
  });
}

// Decision Matrix Table
function buildDecisionMatrixTable() {
  const colWidths = [2600, 3213, 3213];
  const headerRow = new TableRow({
    children: [
      makeHeaderCell("เกณฑ์การพิจารณา", colWidths[0], "1E293B"),
      makeHeaderCell("โมเดล 4 ผลัด (4-Shift Roster)", colWidths[1]),
      makeHeaderCell("โมเดล 2 ผลัด (2-Shift Roster)", colWidths[2]),
    ],
  });

  const data = [
    ["จำนวนสตาฟฟ์ขั้นต่ำที่ต้องการ", "12 – 16 คน (ผลัดละ 3-4 คน)", "6 – 8 คน (ผลัดละ 3-4 คน)"],
    ["เวลาปฏิบัติงานเฉลี่ยต่อคน", "2 ชั่วโมง 15 นาที (เบาสบายมาก)", "4 ชั่วโมง 30 นาที (ต้องมีความอึด)"],
    ["ระดับความกระตือรือร้น (Energy)", "สูงมากตลอดทั้งวัน ไม่เหนื่อยล้า", "อาจเริ่มล้าช่วงท้ายผลัด ต้องมีพักย่อย"],
    ["ความคล่องตัวของสตาฟฟ์", "มีเวลาไปดูงานซุ้มอื่นและเข้ากิจกรรมภาค", "ทำงานรอบเดียวจบ ไม่ต้องคอยพะวงเวลาผลัด"],
    ["ความถี่การส่งมอบงาน (Handover)", "ส่งมอบ 3 ครั้ง (ต้องมีหัวหน้าเวรคุม)", "ส่งมอบเพียง 1 ครั้งตอนเที่ยงวัน"],
    ["สถานการณ์ที่เหมาะสมที่สุด", "วันจริงที่มีผู้เข้าร่วมงานมหาศาล แถวยาว", "วันซ้อมใหญ่, วันที่มีคนปานกลาง หรือคนจำกัด"],
  ];

  const bodyRows = data.map((row, idx) => {
    const fill = idx % 2 === 1 ? "F8FAFC" : "FFFFFF";
    return new TableRow({
      children: [
        makeCell(row[0], colWidths[0], AlignmentType.LEFT, true, fill),
        makeCell(row[1], colWidths[1], AlignmentType.LEFT, false, fill),
        makeCell(row[2], colWidths[2], AlignmentType.LEFT, false, fill),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...bodyRows],
  });
}

// Emergency Incident SOP Table
function buildSOPTable() {
  const colWidths = [2400, 3313, 3313];
  const headerRow = new TableRow({
    children: [
      makeHeaderCell("สถานการณ์ฉุกเฉิน", colWidths[0], "991B1B"),
      makeHeaderCell("ขั้นตอนการปฏิบัติของสตาฟฟ์หน้างาน", colWidths[1], "991B1B"),
      makeHeaderCell("การสั่งการผ่านระบบ Admin (/admin)", colWidths[2], "991B1B"),
    ],
  });

  const data = [
    [
      "กล้องค้าง / หน้าจอ Kiosk จอดำ / USB หลุด",
      "สตาฟฟ์ Role 1 ตะโกนแจ้ง Admin ตรวจสอบสาย USB หลังเครื่องว่าแน่นหรือไม่",
      "กดปุ่ม 'รีสตาร์ทกล้อง' (Reboot Camera) หากยังไม่ติดให้กด 'รีเซ็ตตู้ (Standby)'",
    ],
    [
      "คนเดินตัดหน้ากล้อง หรือน้องยังไม่พร้อม",
      "สตาฟฟ์ Role 1 หรือ Role 3 ยกมือแจ้งหยุดการถ่ายชั่วคราว",
      "กดปุ่ม 'ยกเลิกนับถอยหลัง' (Cancel Countdown) เพื่อกลับสู่ Standby โดยไม่เสียภาพ",
    ],
    [
      "แสงจ้า / ยืนไกล / นั่งวีลแชร์ AI ไม่จับมือ",
      "สตาฟฟ์ Role 1 ช่วยนับจังหวะ และส่งสัญญาณมือให้ Admin ลั่นชัตเตอร์",
      "กดปุ่ม 'ถ่ายภาพฉุกเฉิน' (Emergency Shutter) ระบบจะนับ 3 วินาทีแล้วถ่ายให้ทันที",
    ],
    [
      "ภาพไม่เหมาะสมหลุดถ่ายติดขึ้นมา",
      "สตาฟฟ์ Role 2 ตะโกนแจ้ง 'เซ็นเซอร์' และดำเนินการทันที",
      "กดปุ่ม 'เซ็นเซอร์จอใหญ่ฉุกเฉิน' (Panic Mute) ขึ้นม่านดำ <1ms แล้วกด 'ลบรูป (PDPA)'",
    ],
    [
      "น้องสแกน QR Code ที่จอใหญ่ไม่ทัน",
      "สตาฟฟ์ Role 4 พาน้องมาที่โต๊ะ Admin แจ้งรหัสรูปภาพบนบัตร",
      "ค้นหารหัสรูป แล้วกดปุ่ม 'เปิด QR ให้น้องสแกน' แสดง QR Code ขนาดใหญ่บนจอ Admin",
    ],
  ];

  const bodyRows = data.map((row, idx) => {
    const fill = idx % 2 === 1 ? "FEF2F2" : "FFFFFF";
    return new TableRow({
      children: [
        makeCell(row[0], colWidths[0], AlignmentType.LEFT, true, fill, "991B1B"),
        makeCell(row[1], colWidths[1], AlignmentType.LEFT, false, fill),
        makeCell(row[2], colWidths[2], AlignmentType.LEFT, false, fill),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...bodyRows],
  });
}

// Signatures Table
function buildSignatureTable() {
  const colWidths = [3008, 3009, 3009];
  const row = new TableRow({
    children: [
      new TableCell({
        width: { size: colWidths[0], type: WidthType.DXA },
        borders: TABLE_BORDERS,
        margins: { top: 160, bottom: 160, left: 140, right: 140 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ลงชื่อ........................................................", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(........................................................)", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "หัวหน้าฝ่ายเทคโนโลยีและระบบ Kiosk", bold: true, font: FONT_FAMILY, size: 22 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "วันที่ ...... / ...... / 2569", font: FONT_FAMILY, size: 20, color: "64748B" })] }),
        ],
      }),
      new TableCell({
        width: { size: colWidths[1], type: WidthType.DXA },
        borders: TABLE_BORDERS,
        margins: { top: 160, bottom: 160, left: 140, right: 140 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ลงชื่อ........................................................", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(........................................................)", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "หัวหน้าฝ่ายสถานที่และกำลังพล", bold: true, font: FONT_FAMILY, size: 22 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "วันที่ ...... / ...... / 2569", font: FONT_FAMILY, size: 20, color: "64748B" })] }),
        ],
      }),
      new TableCell({
        width: { size: colWidths[2], type: WidthType.DXA },
        borders: TABLE_BORDERS,
        margins: { top: 160, bottom: 160, left: 140, right: 140 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ลงชื่อ........................................................", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(........................................................)", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "อาจารย์ที่ปรึกษาโครงการ / ผู้รับรอง", bold: true, font: FONT_FAMILY, size: 22 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "วันที่ ...... / ...... / 2569", font: FONT_FAMILY, size: 20, color: "64748B" })] }),
        ],
      }),
    ],
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [row],
  });
}

async function generateDocx() {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "checklist",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "❑",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "roles",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
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
                children: [
                  new TextRun({
                    text: "ภาควิชาวิศวกรรมคอมพิวเตอร์ คณะวิศวกรรมศาสตร์ มศว | เอกสารทางการ CPE-OPH2026-DOC-004",
                    font: FONT_FAMILY,
                    size: 18,
                    color: "94A3B8",
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
                children: [
                  new TextRun({
                    text: "คู่มือเตรียมความพร้อมและบริหารกำลังพล CPE PhotoBooth | หน้า ",
                    font: FONT_FAMILY,
                    size: 18,
                    color: "94A3B8",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_FAMILY,
                    size: 18,
                    color: "94A3B8",
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Document Header / Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "เอกสารแผนปฏิบัติการและบริหารจัดการกำลังพลหน้างาน (ฉบับทางการ)",
                bold: true,
                color: "CE1126",
                font: FONT_FAMILY,
                size: 36, // 18pt
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "โครงการบูธกิจกรรม SWU PhotoBooth ในงานเปิดบ้าน มศว (SWU Open House 2026)\nภาควิชาวิศวกรรมคอมพิวเตอร์ คณะวิศวกรรมศาสตร์ มหาวิทยาลัยศรีนครินทรวิโรฒ",
                bold: true,
                color: "1E293B",
                font: FONT_FAMILY,
                size: 26, // 13pt
              }),
            ],
          }),

          // Metadata Card
          new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            columnWidths: [2200, 6826],
            rows: [
              new TableRow({
                children: [
                  makeCell("รหัสเอกสารควบคุม:", 2200, AlignmentType.LEFT, true, "F1F5F9"),
                  makeCell("CPE-OPH2026-DOC-004 (Rev. 2.0)", 6826, AlignmentType.LEFT, false, "F8FAFC"),
                ],
              }),
              new TableRow({
                children: [
                  makeCell("หน่วยงานที่รับผิดชอบ:", 2200, AlignmentType.LEFT, true, "F1F5F9"),
                  makeCell("คณะทำงานเทคโนโลยีสารสนเทศและสื่อสารองค์กร CPE SWU", 6826, AlignmentType.LEFT, false, "F8FAFC"),
                ],
              }),
              new TableRow({
                children: [
                  makeCell("วันและเวลาจัดกิจกรรม:", 2200, AlignmentType.LEFT, true, "F1F5F9"),
                  makeCell("วันจัดกิจกรรม SWU Open House 2026 เวลา 08:30 – 17:30 น.", 6826, AlignmentType.LEFT, false, "F8FAFC"),
                ],
              }),
              new TableRow({
                children: [
                  makeCell("วัตถุประสงค์หลัก:", 2200, AlignmentType.LEFT, true, "F1F5F9"),
                  makeCell("เพื่อเป็นคู่มือมาตรฐานการตรวจรับครุภัณฑ์-อุปกรณ์หน้างาน, กำหนดบทบาทสตาฟฟ์, จัดตารางผลัดเฝ้าบูธ และรับมือเหตุฉุกเฉิน", 6826, AlignmentType.LEFT, false, "F8FAFC"),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 200 } }),

          // หมวดที่ 1
          createHeading1("1. สรุปรายการอุปกรณ์และครุภัณฑ์ทั้งหมดที่ต้องเตรียมหน้างาน"),
          createParagraph("เพื่อให้การจัดเตรียมอุปกรณ์เป็นไปอย่างครบถ้วน ไม่ตกหล่น และพร้อมใช้งานได้ทันทีในเช้าวันจัดงาน คณะทำงานได้จัดหมวดหมู่อุปกรณ์ออกเป็น 5 หมวดหมู่หลัก ดังต่อไปนี้:"),

          createHeading2("1.1 หมวดตู้ถ่ายภาพ Kiosk Station (Screen 1)"),
          buildEquipmentTable(equipmentSection1),
          new Paragraph({ spacing: { after: 160 } }),

          createHeading2("1.2 หมวดจอแสดงภาพขนาดใหญ่ Showcase Mega Display (Screen 2)"),
          buildEquipmentTable(equipmentSection2),
          new Paragraph({ spacing: { after: 160 } }),

          createHeading2("1.3 หมวดศูนย์ควบคุมสตาฟฟ์ Admin Mission Control"),
          buildEquipmentTable(equipmentSection3),
          new Paragraph({ spacing: { after: 160 } }),

          createHeading2("1.4 หมวดระบบเครือข่าย ไฟฟ้า และความปลอดภัย (Network, Power & Safety)"),
          buildEquipmentTable(equipmentSection4),
          new Paragraph({ spacing: { after: 160 } }),

          createHeading2("1.5 หมวดป้ายบอกทาง พร็อพถ่ายภาพ และอุปกรณ์จัดระเบียบแถว"),
          buildEquipmentTable(equipmentSection5),
          new Paragraph({ spacing: { after: 240 } }),

          new Paragraph({ children: [new PageBreak()] }),

          // หมวดที่ 2
          createHeading1("2. โครงสร้างอัตรากำลังและบทบาทหน้าที่ของสตาฟฟ์ประจำบูธ"),
          createParagraph("เพื่อให้การไหลเวียนของผู้เข้าร่วมงาน (Flow) เป็นไปอย่างรวดเร็วและปลอดภัย บูธ PhotoBooth กำหนดบทบาทสตาฟฟ์ออกเป็น 4 บทบาทหลัก (4 Core Roles) ที่ต้องมีผู้ปฏิบัติหน้าที่ตลอดเวลา:"),

          new Paragraph({
            numbering: { reference: "roles", level: 0 },
            children: [
              new TextRun({ text: "Role 1: ผู้กำกับหน้าตู้และแนะนำท่าทาง (Kiosk Pilot & Gesture Guide)", bold: true, color: "0F172A", font: FONT_FAMILY, size: 24 }),
              new TextRun({ text: "\n• ยืนประจำข้างตู้ Kiosk คอยแนะนำจุดยืนบนสติกเกอร์ที่พื้น (ระยะ 1.8 เมตร)\n• แนะนำผู้เข้าร่วมงานให้แบมือ 5 นิ้วค้างไว้ 1.2 วินาทีเพื่อลั่นชัตเตอร์กล้อง MediaPipe AI\n• ทำสัญญาณมือแจ้งสตาฟฟ์ Admin ทันทีเมื่อกล้องมีปัญหา หรือผู้ใช้นั่งวีลแชร์ที่ระบบตรวจจับไม่ถึง\n• เช็ดทำความสะอาดหน้าเลนส์กล้องด้วยผ้าไมโครไฟเบอร์เมื่อเกิดคราบฝุ่น", font: FONT_FAMILY, size: 24 }),
            ],
          }),

          new Paragraph({
            numbering: { reference: "roles", level: 0 },
            children: [
              new TextRun({ text: "Role 2: ผู้ควบคุมศูนย์บัญชาการ Admin และกำกับ PDPA (Mission Controller & PDPA Officer)", bold: true, color: "0F172A", font: FONT_FAMILY, size: 24 }),
              new TextRun({ text: "\n• ประจำโต๊ะคอมพิวเตอร์หน้าเว็บ /admin เพื่อมอนิเตอร์สถานะระบบทั้ง 2 หน้าจอแบบเรียลไทม์\n• ใช้ปุ่มแท็กติกัลเพื่อแก้ปัญหาทันที: ถ่ายภาพฉุกเฉิน, ยกเลิกนับถอยหลัง, ข้ามพรีวิวเพื่อเร่งระบายแถว\n• เฝ้าระวังจอใหญ่: หากพบภาพหรือท่าทางที่ไม่เหมาะสม ให้กดปุ่ม 'เซ็นเซอร์จอใหญ่ฉุกเฉิน' (Panic Mute) ทันที\n• เปิด QR Code ขนาดใหญ่ให้น้องที่สแกนไม่ทัน และกดลบรูป (PDPA Purge) หากได้รับการร้องขอ", font: FONT_FAMILY, size: 24 }),
            ],
          }),

          new Paragraph({
            numbering: { reference: "roles", level: 0 },
            children: [
              new TextRun({ text: "Role 3: ผู้จัดการแถวและดูแลบรรยากาศ (Queue Marshal & Crowd Controller)", bold: true, color: "0F172A", font: FONT_FAMILY, size: 24 }),
              new TextRun({ text: "\n• จัดระเบียบแถวรอคิวด้านนอก ไม่ให้ล้นไปกีดขวางทางเดินหลักของอาคารเรียน\n• แจกพร็อพถ่ายรูปและบรีฟขั้นตอนการถ่ายภาพเบื้องต้นให้น้องในแถวล่วงหน้า เพื่อลดเวลาการยืนงงหน้าตู้\n• ป้องกันไม่ให้มีผู้เดินตัดหน้ากล้องระหว่างที่กำลังนับถอยหลังถ่ายภาพ", font: FONT_FAMILY, size: 24 }),
            ],
          }),

          new Paragraph({
            numbering: { reference: "roles", level: 0 },
            children: [
              new TextRun({ text: "Role 4: ผู้ช่วยดาวน์โหลดและแนะนำการแต่งรูป (Mobile & QR Download Helper)", bold: true, color: "0F172A", font: FONT_FAMILY, size: 24 }),
              new TextRun({ text: "\n• ยืนประจำข้างจอใหญ่ Showcase คอยชี้ตำแหน่ง QR Code ให้น้องๆ สแกนหลังถ่ายเสร็จ\n• ให้คำแนะนำการแต่งรูป ใส่สติกเกอร์ และใส่ฟิลเตอร์บนมือถือผ่านหน้าเว็บ /p/[code]\n• อำนวยความสะดวกกรณีสัญญาณเน็ตมือถือน้องไม่ดี เช่น ช่วยแชร์ Hotspot หรือพาน้องมาสแกนที่โต๊ะ Admin", font: FONT_FAMILY, size: 24 }),
            ],
          }),

          new Paragraph({ spacing: { after: 200 } }),

          // หมวดที่ 3
          createHeading1("3. แผนการบริหารกำลังพล โมเดล 4 ผลัด (4-Shift Master Roster) — แนะนำ"),
          createParagraph("โมเดลนี้เน้นการหมุนเวียนกำลังพลบ่อยครั้ง (ผลัดละประมาณ 2 ชั่วโมง 15 นาที) เพื่อให้สตาฟฟ์ทุกคนมีพลังงานเต็มเปี่ยม ยิ้มแย้ม กระตือรือร้น และมีเวลาไปร่วมกิจกรรมอื่นของภาควิชาได้อย่างทั่วถึง:"),
          build4ShiftTable(),

          createParagraph("\nระเบียบปฏิบัติในการส่งมอบงาน (Handover Protocol 10 นาที):", true),
          createParagraph("1. สตาฟฟ์ผลัดใหม่ต้องมารายงานตัวที่บูธก่อนเวลาเริ่ม 10 นาที (เช่น 10:35, 12:50, 15:05 น.)\n2. สตาฟฟ์ Admin เดิมบรีฟปัญหาที่พบ (เช่น มุมแสง, ปัญหาเน็ต, รูปที่ถูกลบล่าสุด, ระดับแบตเตอรี่)\n3. ตรวจสอบความสะอาดหน้าเลนส์ และจัดระเบียบพร็อพให้เรียบร้อยก่อนส่งมอบเวรอย่างเป็นทางการ"),

          new Paragraph({ children: [new PageBreak()] }),

          // หมวดที่ 4
          createHeading1("4. แผนการบริหารกำลังพล โมเดล 2 ผลัด (2-Shift Master Roster) — ทีมกระชับ"),
          createParagraph("โมเดลนี้เหมาะสำหรับกรณีที่มีกำลังพลจำกัด โดยแบ่งทีมงานเป็น 2 ชุด (ทีม A เช้า และ ทีม B บ่าย) กะละ 4.5 ชั่วโมง โดยใช้ระบบหมุนเวียนพักย่อย (Micro-Break System) เพื่อให้สตาฟฟ์ได้พักผ่อนและรับประทานอาหาร:"),
          build2ShiftTable(),

          createParagraph("\nกติกาการพักย่อย (Micro-Break Rules):", true),
          createParagraph("• ในช่วงพักรับประทานอาหารกลางวัน (11:30 – 12:30 น.) ห้ามทิ้งบูธว่างเด็ดขาด ต้องมีสตาฟฟ์อย่างน้อย 2 คนคุมสถานีหลัก (Role 1 ควบ Role 3 และ Role 2 หน้าจอ Admin)\n• สลับกันไปรับประทานอาหารรอบละ 2 คน ครั้งละไม่เกิน 30 นาที"),

          new Paragraph({ spacing: { after: 200 } }),

          // หมวดที่ 5
          createHeading1("5. ตารางเปรียบเทียบและการตัดสินใจเลือกโมเดลบริหารกำลังพล (Decision Matrix)"),
          createParagraph("เพื่อช่วยให้คณะทำงานเลือกโมเดลที่เหมาะสมที่สุดสำหรับสภาพแวดล้อมและจำนวนกำลังพลในวันงานจริง:"),
          buildDecisionMatrixTable(),

          new Paragraph({ spacing: { after: 240 } }),

          new Paragraph({ children: [new PageBreak()] }),

          // หมวดที่ 6
          createHeading1("6. ระเบียบปฏิบัติประจำวันและแผนเผชิญเหตุฉุกเฉิน (Incident Response SOP)"),
          createParagraph("เมื่อเกิดเหตุขัดข้องหน้างาน สตาฟฟ์ทุกตำแหน่งต้องปฏิบัติตามแนวทางมาตรฐานโดยทันทีเพื่อไม่ให้คิวสะดุด:"),
          buildSOPTable(),

          new Paragraph({ spacing: { after: 240 } }),

          // หมวดที่ 7
          createHeading1("7. แบบฟอร์มตรวจสอบความพร้อมก่อนเปิดและหลังปิดบูธ (Verification Checklists)"),
          createParagraph("สตาฟฟ์หัวหน้าผลัดต้องทำการตรวจสอบรายการตามเช็กลิสต์ด้านล่างนี้ทุกเช้าและเย็น:"),

          createHeading2("☀️ รายการตรวจสอบความพร้อมรอบเช้า (08:00 – 08:30 น.)"),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "เสียบปลั๊กพ่วง ต่อไฟเลี้ยง Kiosk PC, ทีวีจอใหญ่ Showcase และเราเตอร์ 5G CPE เรียบร้อย", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "เปิดเราเตอร์ 5G CPE ยืนยันไฟสถานะ Internet เป็นสีฟ้า/เขียว พร้อมสัญญาณ Wi-Fi 5GHz ปล่อยปกติ", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "ติดสติกเกอร์ระบุจุดยืนถ่ายรูปบนพื้นห่างจากเลนส์กล้อง 1.8 เมตร", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "ยึดสายไฟและสาย LAN กับพื้นด้วยเทปผ้า Gaffer Tape อย่างแน่นหนา ไม่มีสายลอยให้สะดุด", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "เปิดเบราว์เซอร์ทั้ง 3 หน้าจอ: จอ 1 (/kiosk), จอ 2 (/display), จอ Admin (/admin)", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "กดปุ่ม 'Ping Bus' ในหน้า Admin เพื่อยืนยันว่าหน้าจอ Kiosk และ Showcase ซิงค์กัน (<1ms)", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "กดปุ่ม 'ทดสอบสปีด' ในการ์ดเครือข่าย ยืนยันว่า Latency ปกติและพร้อมให้บริการ", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "ทดลองถ่ายภาพทดสอบ 1 ภาพ: แบมือ 5 นิ้ว -> นับถอยหลัง -> ภาพขึ้นจอ 2 -> ใช้มือถือสแกนรับรูปได้จริง", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "กดปุ่มลบรูปภาพทดสอบออกจากระบบเพื่อเตรียมพร้อมรับผู้เข้าร่วมงานชุดแรก", font: FONT_FAMILY, size: 24 })] }),

          new Paragraph({ spacing: { after: 160 } }),

          createHeading2("🌙 รายการตรวจสอบการปิดบูธรอบเย็น (17:00 – 17:30 น.)"),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "กดปุ่ม 'พักบูธชั่วคราว' (Pause Booth) ในหน้า Admin เพื่อหยุดรับคิวถ่ายรูป", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "ตรวจสอบว่าไม่มีผู้เข้าร่วมงานตกค้างรอรับภาพ หรือต้องการขอความช่วยเหลือ", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "ปิดหน้าต่างเบราว์เซอร์ และสั่ง Shutdown คอมพิวเตอร์และจอทีวีอย่างปลอดภัย", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "ถอดปลั๊กไฟ ม้วนเก็บสายไฟ สาย HDMI และสาย LAN ให้เรียบร้อย", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "ลอกเทปผ้าออกจากพื้น เช็ดทำความสะอาดคราบกาวและพื้นที่โดยรอบ", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "เก็บพร็อพถ่ายรูป ป้าย X-Stand และอุปกรณ์ทำความสะอาดลงกล่องเก็บของ", font: FONT_FAMILY, size: 24 })] }),
          new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun({ text: "ตรวจนับจำนวนอุปกรณ์ตาม Master Equipment Checklist ในข้อ 1 ให้ครบถ้วนก่อนส่งมอบห้อง", font: FONT_FAMILY, size: 24 })] }),

          new Paragraph({ spacing: { after: 240 } }),

          // หมวดที่ 8: ส่วนลงนาม
          createHeading1("8. การลงนามรับทราบและอนุมัติแผนปฏิบัติการ"),
          createParagraph("เอกสารฉบับนี้ได้รับการตรวจสอบความถูกต้องและความพร้อมในด้านเทคโนโลยี ฮาร์ดแวร์ และการบริหารกำลังพลเรียบร้อยแล้ว:"),
          new Paragraph({ spacing: { after: 120 } }),
          buildSignatureTable(),
        ],
      },
    ],
  });

  const outputPath = path.join(__dirname, '..', 'docs', 'CPE_SWU_OPENHOUSE_ONSITE_OPERATIONS_MANUAL.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`OFFICIAL_DOCX_GENERATED_SUCCESSFULLY: ${outputPath}`);
}

generateDocx().catch((err) => {
  console.error("GENERATION_FAILED:", err);
  process.exit(1);
});
