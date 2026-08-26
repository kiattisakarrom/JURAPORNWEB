# PharmAuto Package Workflow MVP

อัปเดตล่าสุด: 21 สิงหาคม 2026

## ขอบเขตและหลักการ

- `dbo.TBLORX`, `dbo.TBLORXITEMS` และ `dbo.TBLORXITEMS_HISTORY` เป็นข้อมูลต้นทางแบบ Read-only
- Frontend เรียก Backend API เท่านั้น ไม่เชื่อม SQL Server โดยตรง
- งานใหม่เก็บในตาราง `dbo.TBLWORKFLOWMASTER`, `dbo.TBLPACKAGEPRESCRIPTIONS`,
  `dbo.TBLPACKAGEMASTER`, `dbo.TBLPACKAGEITEMS` และ `dbo.TBLPACKAGEEVENTS`
- หนึ่ง VN มี Workflow ที่ active ได้หนึ่งงาน และมี Package ที่ active ได้หนึ่งแพ็กเกจ
- ใช้ `VISITDATETIME + VISITNUMBER + WORKFLOW_RUN_NO` แยกรอบงาน จึงรองรับ VN/HN เดิมที่กลับมาใหม่หลังงานเก่าจบ
- Picking Location, Finance และ Login/Role ยัง bypass ชั่วคราวตามขอบเขต MVP

## การติดตั้งฐานข้อมูล

Local ถูกลบ schema `workflow.*` รุ่นทดลองเดิมและสร้างตารางชุดใหม่แล้ว หากต้องทำซ้ำ:

```bash
cd /Users/fam/Documents/JurapornWeb/backend
npm run db:workflow:cleanup:local
npm run db:package:local
npm run db:package:validate:local
```

สร้างที่ Live ภายหลัง โดยเปิด VPN และตรวจ `.env.live` ให้ถูกต้องก่อน:

```bash
cd /Users/fam/Documents/JurapornWeb/backend
npm run db:package:live
npm run db:package:validate:live
```

หรือเปิดไฟล์ `backend/sql/001_create_package_workflow_schema.sql` ใน SSMS แล้ว Execute
กับฐานปลายทางได้โดยตรง สคริปต์ตรวจ `IF NOT EXISTS` และรันซ้ำได้ ส่วน
`backend/sql/002_drop_legacy_workflow_schema.sql` ใช้ลบเฉพาะ schema `workflow.*`
รุ่นเดิมและไม่แตะตารางต้นทาง ส่วน `backend/sql/003_validate_package_workflow.sql`
ตรวจว่าตารางและคอลัมน์ที่ Backend ใช้มีครบโดยไม่แก้ข้อมูล

## ตารางใหม่

| ตาราง | หน้าที่ |
|---|---|
| `TBLWORKFLOWMASTER` | ตัวตนงานต่อรอบ VN, สถานะเคส, Queue, Payment gate และ Verify lease |
| `TBLPACKAGEPRESCRIPTIONS` | สถานะ Verify ราย PN เช่น `WAITING`, `VERIFIED_WAITING`, `PARTIAL`, `PACKAGED` |
| `TBLPACKAGEMASTER` | แพ็กเกจยา รอบยาด่วน/ปกติ, `PAGE_NOW`, pickup status และเวลาแต่ละขั้นตอน |
| `TBLPACKAGEITEMS` | Snapshot รายการยาในแพ็กเกจ, MEDICINECODE, QR ฉลาก และผล Matching/Checking |
| `TBLPACKAGEEVENTS` | Audit log การล็อก, transition, scan ถูก/ผิด, พิมพ์ฉลาก, เรียกและรับยา |

## พฤติกรรม Verify

### ปกติ

- VN มี PN เดียว: กด Verify ที่ PatientPanel แล้ว Backend สร้าง Package และส่งไป Picking ทันที
- VN มีหลาย PN: แต่ละ PN ที่ Verify แล้วเป็น `VERIFIED_WAITING`; เมื่อกด PN สุดท้าย Backend
  สร้าง Package เดียวจากยาที่ยังไม่เคยถูกจัดแพ็กเกจทั้งหมด และส่งไป Picking โดยอัตโนมัติ
- ไม่มีปุ่มส่ง VN ซ้ำที่แถวหน้า Verify

### ยาด่วน

- เปิดตัวเลือก “ยาด่วน” และเลือกยาทีละรายการใน PatientPanel
- Backend สร้าง Urgent Package เฉพาะยาที่เลือกทันที
- VN และ PN ทั้งหมดยังแสดงในหน้า Verify แต่รายการที่ส่งแล้วแสดงหน้าปัจจุบันของแพ็กเกจ
- ยาที่เหลือถูกล็อกจน Urgent Package มีสถานะรับยา `RECEIVED`

### การทำงานพร้อมกัน

- ก่อนแก้ไข PatientPanel ต้อง claim Verify lease ของทั้ง VN
- Lease มีอายุ 5 นาที และ Frontend heartbeat ทุก 30 วินาที
- ผู้ใช้อื่นเปิดดูได้แบบ Read-only ระหว่างที่ VN ถูกล็อก
- Transaction ระดับ `SERIALIZABLE`, `UPDLOCK/HOLDLOCK`, unique active workflow/package
  และ idempotency key ป้องกันการสร้างงานหรือแพ็กเกจซ้ำ

## ลำดับงาน

```text
Verify/Pending → Picking → Matching → Checking → Dispensing
                                                   ├─ WAITING_CALL
                                                   ├─ CALLED_WAITING
                                                   └─ RECEIVED → Complete/ปลดล็อกยาที่เหลือ
```

- Matching สแกน `MEDICINECODE`; เมื่อตรงจึงเปลี่ยนรายการเป็น completed และบันทึกการพิมพ์ฉลาก
- Checking ส่ง `MEDICINECODE + QR_TOKEN`; ต้องตรงกันจึงผ่าน
- ทั้ง scan ที่ถูกและผิดถูกบันทึกใน `TBLPACKAGEEVENTS`; scan ผิดไม่เลื่อนสถานะ
- Dispensing ต้องกดเรียกผู้ป่วยก่อน แล้วจึงกด “ผู้ป่วยรับยาแล้ว” เพื่อจบแพ็กเกจ

## API ที่ Frontend ใช้

| API | หน้าที่ในหน้าเว็บ |
|---|---|
| `GET /api/v1/verify/prescriptions` | ข้อมูลต้นทาง Verify: HN/VN/PN/แพทย์/รายการยา |
| `GET /api/v1/package-workflows` | Overlay สถานะ PN, ยาที่ถูกส่ง, Pending, active package และ Verify lock |
| `POST /api/v1/package-workflows/verify-lock` | ขอสิทธิ์แก้ไข VN |
| `POST .../verify-lock/heartbeat` | ต่ออายุล็อกทุก 30 วินาที |
| `DELETE .../verify-lock` | ปล่อยล็อกเมื่อปิด PatientPanel |
| `POST .../verify` | Verify PN ปกติหรือสร้างแพ็กเกจยาด่วน |
| `POST /api/v1/package-workflows/pending` | ส่ง VN จาก Verify ไป Pending |
| `POST .../return-to-verify` | ส่ง VN จาก Pending กลับ Verify |
| `GET /api/v1/packages` | คิว Picking, Matching, Checking, Dispensing และ Complete |
| `POST .../transitions` | ส่งแพ็กเกจไปขั้นถัดไป |
| `POST .../matching/scan` | ตรวจรหัสยาและบันทึกผล scan |
| `POST .../checking/validate-pair` | ตรวจรหัสยาคู่กับ QR ฉลาก |
| `POST .../dispensing/status` | เรียกผู้ป่วยหรือยืนยันรับยา |

## ข้อมูลที่ยังไม่ใช้หรือยังรอการจับคู่

- `TBLORXITEMS_HISTORY`: ยังไม่ได้ใช้ใน MVP; เก็บไว้ Read-only เพื่อออกแบบ audit/source-change ภายหลัง
- `SOURCE_URGENCY_CODE`: มีช่องรองรับใน Package Item แต่ยังไม่ได้ map field ด่วนจากทีมต้นทาง
- Picking Location: ตอนนี้การส่ง Picking → Matching ถือว่าครบทุก Location ทันที
- `PAYMENT_STATUS`: ตั้ง `BYPASSED`; รอ Finance API แล้วค่อยบังคับ `PAID`
- `USER_APPROVE`/สิทธิ์: ตอนนี้ส่งชื่อ `Pharmacist` ชั่วคราวและเปิดทุก action เพราะยังไม่มี Login
- Queue number: `QUEUE_NO` รองรับแล้ว แต่หน้า Verify เว้นค่าว่างจนได้รับ API ลำดับคิว
- Label printer: Backend สร้าง QR และบันทึกสถานะพิมพ์ แต่ยังไม่ได้เชื่อม Print Agent/เครื่องพิมพ์จริง

## การตรวจโปรเจกต์

```bash
cd /Users/fam/Documents/JurapornWeb/backend
npm run lint
npm test
npm run build

cd /Users/fam/Documents/JurapornWeb/frontend
npm run lint
npm run build
```
