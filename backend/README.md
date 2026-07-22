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
cp .env.example .env
```

กำหนดค่าการเชื่อมต่อจริงใน `.env` โดยห้าม commit ไฟล์นี้ จากนั้นเริ่ม Development server:

```bash
npm run start:dev
```

Backend ใช้ Port `3001` เป็นค่าเริ่มต้น

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
    └── verify/   # Prescription verification
```

ทุก Query ที่รับค่าจาก Request ต้องส่งค่าผ่าน `request.input()` ห้ามนำค่ามาต่อเป็น SQL string โดยตรง
