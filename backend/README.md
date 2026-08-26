# Juraporn API

Backend แบบ NestJS สำหรับอ่านข้อมูลจาก Microsoft SQL Server โดยมี Endpoint เริ่มต้นดังนี้:

- `GET /api/v1/verify`
- `GET /api/v1/verify/prescriptions`
- `GET /api/v1/patients/:patientId`

รายละเอียด Request และ Response อยู่ที่ `../docs/API-CONTRACT.md`

## Requirements

- Node.js 20 ขึ้นไป
- SQL Server ที่ Backend เชื่อมต่อได้

## Setup

```bash
npm install
cp .env.example .env.local
cp .env.example .env.live
```

กำหนดค่าการเชื่อมต่อ Local ใน `.env.local` และฐานข้อมูลเครื่องจริงใน
`.env.live` โดยห้าม commit ไฟล์ทั้งสอง จากนั้นเลือกฐานข้อมูลตอนเริ่ม Backend

ใช้ฐานข้อมูล Local (เป็นค่าเริ่มต้น):

```bash
npm run start:dev:local
```

ใช้ฐานข้อมูลเครื่องจริง:

```bash
npm run start:dev:live
```

Backend ใช้ Port `3001` เป็นค่าเริ่มต้น

## Package workflow database

ลบ schema `workflow.*` รุ่นทดลองเดิมบน Local (คำสั่งนี้ลบข้อมูลเดิม):

```bash
npm run db:workflow:cleanup:local
```

สร้างตาราง Package Workflow ชุดใหม่บน Local:

```bash
npm run db:package:local
npm run db:package:validate:local
```

สร้างตารางชุดเดียวกันบน Live ภายหลัง (เปิด VPN และตรวจ `.env.live` ก่อน):

```bash
npm run db:package:live
npm run db:package:validate:live
```

SQL ต้นฉบับอยู่ที่ `sql/001_create_package_workflow_schema.sql` ส่วนไฟล์ลบ
ของเดิมอยู่ที่ `sql/002_drop_legacy_workflow_schema.sql` และรายละเอียด API อยู่ที่
`../docs/WORKFLOW-MVP.md` ตารางต้นทาง `TBLORX`, `TBLORXITEMS` และ
`TBLORXITEMS_HISTORY` เป็น Read-only สำหรับระบบนี้

เมื่อจะสลับฐานข้อมูล ให้หยุด Backend เดิมด้วย `Ctrl+C` ก่อน แล้วรันคำสั่งของ
โปรไฟล์ที่ต้องการใหม่ ค่า `DB_PROFILE` ที่รองรับคือ `local` และ `live`

สำหรับไฟล์ที่ build แล้ว สามารถเลือกโปรไฟล์ด้วยคำสั่ง:

```bash
npm run start:prod:local
npm run start:prod:live
```

## Verify

```bash
npm run lint
npm test
npm run build
```

## Structure

```text
src/
├── config/       # ตรวจสอบ environment variables
├── database/     # SQL Server connection pool
└── modules/
    ├── patient/  # Patient และ Vital Signs
    ├── verify/   # อ่าน Prescription ต้นทาง
    └── package-workflow/ # ล็อก Verify, Package, Scan และ Stage transition
```

ทุก Query ที่รับค่าจาก Request ต้องส่งค่าผ่าน `request.input()` ห้ามนำค่ามาต่อเป็น SQL string โดยตรง
