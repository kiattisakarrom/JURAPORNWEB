# ติดตั้ง JurapornWeb บน Windows สำหรับใช้งานผ่าน LAN

เอกสารนี้ใช้กับเครื่อง Windows Full Stack หนึ่งเครื่องที่รัน SQL Server, Backend และ Frontend และให้เครื่องลูกข่ายเข้าใช้งานผ่าน Browser ภายใน LAN

> ระบบรุ่นนี้ยังไม่มี Login/Authorization ให้ติดตั้งเฉพาะ Private LAN ที่เชื่อถือได้ ห้ามเปิดพอร์ตออกอินเทอร์เน็ต

## 1. สิ่งที่ต้องมี

- Windows Server หรือ Windows 10/11 ที่กำหนด hostname หรือ IP ให้คงที่
- Node.js 20 ขึ้นไป และ npm
- SQL Server พร้อมฐานข้อมูลสำเนาที่มีตารางต้นทางเดิมอยู่แล้ว
- Source code JurapornWeb
- SQL account สองประเภท:
  - **Installer account** ใช้ครั้งเดียวตอนติดตั้ง ต้องสร้าง/แก้ schema, trigger, Change Tracking และ database option ได้
  - **Runtime account** ใส่ใน environment ตอนเปิดระบบจริง ให้เฉพาะสิทธิ์อ่านข้อมูลต้นทางและอ่าน/เขียนตาราง workflow ที่แอปใช้ ไม่ให้สิทธิ์ `sysadmin` หรือ `db_owner`

โปรเจกต์นี้ไม่ได้สร้างฐานโรงพยาบาลจากฐานว่าง ก่อนติดตั้งต้องมีอย่างน้อย `TBLORX`, `TBLORXITEMS`, `TBLPATIENT`, `TBLMEDITEMSINFO`, `TBLDOCTOR`, `TBLDEPT`, `TBLALLERGY` และ `DrugInteraction`

## 2. เตรียม Source และ Dependencies

เปิด PowerShell หรือ Command Prompt ที่โฟลเดอร์โปรเจกต์:

```powershell
cd C:\JurapornWeb\backend
npm ci
npm run db:bundle

cd C:\JurapornWeb\frontend
npm ci
```

`db:bundle` สร้าง `backend\sql\JurapornWeb_install_fullstack.sql` จาก 001, 005, 009, 003 และ 006 โดยอัตโนมัติ ห้ามแก้ไฟล์รวมโดยตรง ให้แก้ migration ต้นฉบับแล้วสร้าง bundle ใหม่

บนเครื่องพัฒนา Local ที่ SQL account มีสิทธิ์สร้างฐานชั่วคราว สามารถทดสอบ first install และรันซ้ำกับฐานโครงสร้างเปล่าที่สร้าง/ลบอัตโนมัติได้ด้วย `npm run db:install:test:local` สคริปต์ปฏิเสธ DB host ที่ไม่ใช่ localhost

ไฟล์ที่ไม่รวมใน installer:

- 002 เป็นคำสั่งลบ legacy schema
- 004 เป็นข้อมูลทดสอบ AI/DI
- 007 เป็น rollback realtime
- 008 ใช้เพิ่ม NOTE ให้ฐานเก่าที่ติดตั้ง 001 รุ่นก่อน ส่วน installer ปัจจุบันมีคอลัมน์นี้แล้ว

## 3. Environment ของ Backend

คัดลอก `backend\.env.example` เป็น `backend\.env.local` และอย่า commit ไฟล์นี้:

```dotenv
NODE_ENV=production
DB_PROFILE=local
PACKAGE_WORKFLOW_ENABLED=true
HOSPITAL_QUEUE_CALLBACK_ENABLED=false
DISPENSING_ADMIN_USERNAME=CHANGE_ME
DISPENSING_ADMIN_PASSWORD=CHANGE_ME
PORT=3001
CORS_ORIGINS=http://PHARMA-SERVER:3000,http://192.168.1.50:3000

DB_HOST=127.0.0.1
DB_PORT=1433
DB_NAME=YOUR_HOSPITAL_DATABASE
DB_USER=juraporn_runtime
DB_PASSWORD=CHANGE_ME
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
DB_POOL_MAX=20
DB_POOL_MIN=0
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=15000
DB_REQUEST_TIMEOUT_MS=30000

REALTIME_DATASET_EPOCH=windows-lan-v1
```

- เปลี่ยน hostname, IP, ชื่อฐานและรหัสผ่านให้ตรงเครื่องจริง
- `CORS_ORIGINS` ต้องใส่ Origin ที่ผู้ใช้เปิดจริง คั่นหลายค่าด้วย comma และไม่มี `/` ท้าย URL
- เก็บ `.env.local` ให้เฉพาะ Windows service account ที่รัน Backend อ่านได้
- ถ้ามีการ restore/แทนฐานที่ hostname และชื่อฐานเดิม ให้เปลี่ยน `REALTIME_DATASET_EPOCH` แล้ว restart Backend

## 4. ติดตั้งฐานข้อมูล

สำรองฐานและตรวจว่าเลือกฐานสำเนาที่ถูกต้องก่อนทุกครั้ง

### วิธี A: รันผ่าน npm

ชั่วคราวให้ `DB_USER`/`DB_PASSWORD` ใน `.env.local` เป็น **Installer account** แล้วรัน:

```powershell
cd C:\JurapornWeb\backend
npm run db:install:local
```

เมื่อสำเร็จ ให้เปลี่ยน credentials ใน `.env.local` กลับเป็น **Runtime account** ก่อนเปิด Backend การติดตั้งไม่ได้ทำให้แอปต้องใช้สิทธิ์ DBA ต่อ

### วิธี B: รันผ่าน SSMS

1. เปิด `backend\sql\JurapornWeb_install_fullstack.sql`
2. เลือกฐานข้อมูลสำเนาที่ถูกต้องใน SSMS
3. เชื่อมต่อด้วย Installer account แล้ว Execute
4. ต้องเห็นข้อความ `JurapornWeb full-stack database installation and validation completed successfully.`

Installer ตรวจ source table/column, Primary Key, สิทธิ์, legacy schema ก่อนแก้ฐาน จากนั้นสร้าง Package Workflow, เปิด Snapshot Isolation/Change Tracking, สร้าง helper table/trigger และตารางคิวจ่ายยา 8 ช่อง ก่อน validate ผลท้ายไฟล์ ไฟล์รันซ้ำได้และไม่ insert seed

หลังติดตั้งควรพบ:

- Workflow 5 ตาราง: `TBLWORKFLOWMASTER`, `TBLPACKAGEPRESCRIPTIONS`, `TBLPACKAGEMASTER`, `TBLPACKAGEITEMS`, `TBLPACKAGEEVENTS`
- NOTE draft 3 คอลัมน์ใน `TBLWORKFLOWMASTER`
- Realtime helper 1 ตาราง: `TBLREALTIMEINVALIDATIONS`
- Dispensing 2 ตาราง: `TBLHOSPITALQUEUESTEP`, `TBLDISPENSINGCHANNELCLAIMS`
- Change Tracking 13 ตาราง
- Trigger 2 ตัว: `TR_TBLALLERGY_Realtime`, `TR_DrugInteraction_Realtime`
- `ALLOW_SNAPSHOT_ISOLATION = ON`

Callback โรงพยาบาลยังปิดอยู่ตามค่าเริ่มต้น เปิด `HOSPITAL_QUEUE_CALLBACK_ENABLED=true`
เฉพาะหลังตรวจ VPN/firewall และทดสอบ `POST /api/hospital/queue/step-id` แล้ว
endpoint นี้ยังไม่มี token จึงห้ามเปิดพอร์ต 3001 สู่อินเทอร์เน็ต ดู
[คู่มือคิวจ่ายยา](./DISPENSING-QUEUE.md) สำหรับวิธีปลดช่องค้างและข้อจำกัด API โรงพยาบาล

### สิทธิ์ Runtime

ให้ DBA กำหนด least privilege ตามตารางที่ Backend ใช้จริง โดยหลักคือ:

- `SELECT` ตารางต้นทาง/ตารางอ้างอิงและตาราง workflow
- `INSERT`/`UPDATE` เฉพาะตาราง workflow/package/event และตารางคิวจ่ายยา
  `TBLHOSPITALQUEUESTEP`, `TBLDISPENSINGCHANNELCLAIMS` ที่ API เขียน
- `VIEW CHANGE TRACKING` และ `SELECT` บนตารางที่เปิด Change Tracking
- ไม่ให้ `ALTER DATABASE`, `ALTER TABLE`, `CREATE TABLE`, `CONTROL`, `db_owner` หรือ `sysadmin`

สิทธิ์ Installer กับ Runtime แยกกันเพื่อให้ถ้า credentials ของเว็บรั่ว ผู้โจมตีจะไม่สามารถเปลี่ยน schema, ปิด trigger หรือควบคุม SQL Server ทั้งเครื่องได้ บนเครื่องพัฒนา Local จะใช้ account เดียวชั่วคราวได้ แต่เครื่องใช้งานจริงควรแยก

## 5. ข้อมูลทดสอบ AI/DI — Local เท่านั้น

ไฟล์ `backend\sql\004_seed_verify_alert_test_data.sql` ไม่อยู่ใน installer และไม่มีคำสั่ง seed สำหรับ Live

เฉพาะฐานสำเนาสำหรับทดสอบ ให้ตรวจ `.env.local` อีกครั้งแล้วรัน:

```powershell
cd C:\JurapornWeb\backend
npm run db:seed:verify-alerts:local
```

Seed สร้างข้อมูลของวันที่รันสำหรับ AI, DI ข้าม PN และ AI+DI โดยใช้ `TEST...` และรหัสยา `14999...` หากรหัสจองไว้ชนข้อมูลที่ไม่ใช่ seed สคริปต์จะหยุดและ rollback ก่อนแก้ข้อมูล ห้ามรันไฟล์นี้บน Live

## 6. Build Backend และ Frontend

Frontend ฝังค่า API URL ตอน build จึงต้องสร้าง environment ก่อน build คัดลอก `frontend\.env.example` เป็น `frontend\.env.production.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://PHARMA-SERVER:3001/api/v1
```

ใช้ hostname หรือ IP คงที่ที่เครื่องลูกข่ายเข้าถึงได้ ห้ามใช้ `localhost` เพราะบนเครื่องลูกข่ายจะหมายถึงเครื่องลูกข่ายเอง

```powershell
cd C:\JurapornWeb\backend
npm run lint
npm test
npm run build

cd C:\JurapornWeb\frontend
npm run lint
npm run test:realtime
npm run build
```

เมื่อเปลี่ยน `NEXT_PUBLIC_API_BASE_URL` ต้อง build Frontend ใหม่

## 7. เปิด Firewall เฉพาะ Private LAN

เปิด PowerShell แบบ Run as administrator:

```powershell
New-NetFirewallRule -DisplayName "JurapornWeb Frontend 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "JurapornWeb Backend 3001" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private
```

ไม่ต้องเปิด TCP 1433 ให้เครื่องลูกข่าย เพราะ Backend ต่อ SQL Server ผ่าน `127.0.0.1` ภายในเครื่องเดียวกัน ถ้ากฎองค์กรบังคับให้ Browser เรียก Backend ผ่าน reverse proxy ให้เปิดเฉพาะพอร์ตของ proxy และตั้งค่าไม่ให้ buffer SSE

## 8. ทดสอบก่อนตั้งให้เริ่มอัตโนมัติ

เปิด Terminal สองหน้าต่าง:

```powershell
C:\JurapornWeb\deploy\windows\start-backend.cmd
```

```powershell
C:\JurapornWeb\deploy\windows\start-frontend.cmd
```

ทดสอบจากเครื่องลูกข่าย:

- เปิด `http://PHARMA-SERVER:3000`
- ตรวจหน้า Verify และ workflow ทุกขั้น
- เปิด Browser สองเครื่อง ตรวจ lock, Pending, NOTE autosave และ realtime
- ตรวจ REST เช่น `http://PHARMA-SERVER:3001/api/v1/verify/prescriptions`
- ตรวจ SSE ด้วย `curl.exe -N http://PHARMA-SERVER:3001/api/v1/realtime/events`

ระบบ realtime รุ่นนี้รองรับ Backend เพียง **หนึ่ง process/instance** ห้ามเปิด Backend ซ้ำสอง Task หรือทำ load balancing หลาย instance

## 9. ตั้ง Task Scheduler

ตั้ง SQL Server service เป็น `Automatic` ก่อน แล้วสร้าง Task สองรายการด้วย Windows Task Scheduler ภายใต้ Windows service account ที่อ่าน source และ `.env` ได้:

### JurapornWeb Backend

- Trigger: `At startup`, Delay 30 seconds
- Program: `C:\Windows\System32\cmd.exe`
- Arguments: `/c "C:\JurapornWeb\deploy\windows\start-backend.cmd"`
- Start in: `C:\JurapornWeb`
- Run whether user is logged on or not
- ถ้า Task ล้ม ให้ restart ทุก 1 นาที
- ตั้ง `If the task is already running` เป็น `Do not start a new instance`

### JurapornWeb Frontend

- Trigger: `At startup`, Delay 45 seconds
- Program: `C:\Windows\System32\cmd.exe`
- Arguments: `/c "C:\JurapornWeb\deploy\windows\start-frontend.cmd"`
- Start in: `C:\JurapornWeb`
- Run whether user is logged on or not
- ถ้า Task ล้ม ให้ restart ทุก 1 นาที
- ตั้ง `If the task is already running` เป็น `Do not start a new instance`

ถ้า SQL Server เริ่มช้ากว่า 30 วินาที Backend จะจบด้วย error และ Task Scheduler ต้องเริ่มใหม่ตามค่าข้างต้น หลัง reboot ให้ตรวจว่า Port 3000/3001 เปิดและมี Backend เพียง process เดียว

## 10. Checklist ส่งมอบ

- [ ] Hostname/IP ของ Server คงที่
- [ ] สำรองและเลือกฐานสำเนาที่ถูกต้อง
- [ ] Installer account ผ่าน preflight
- [ ] `npm run db:install:local` สำเร็จ และรันซ้ำได้
- [ ] เปลี่ยน `.env.local` กลับเป็น Runtime account ที่ไม่ใช่ DBA
- [ ] Workflow 5 ตาราง, Dispensing 2 ตาราง, NOTE, CT 13 ตาราง, trigger 2 ตัว และ Snapshot Isolation ผ่าน validation
- [ ] ไม่ได้รัน 004 seed บน Live
- [ ] Backend lint/test/build ผ่าน
- [ ] Frontend lint/test/build ผ่านหลังตั้ง LAN API URL
- [ ] เครื่องลูกข่ายเปิดหน้าเว็บและ REST/SSE ผ่าน
- [ ] Verify → Picking → Matching → Checking → Dispensing, Pending และ NOTE autosave ผ่าน
- [ ] ทดสอบ lock/realtime จากอย่างน้อยสอง Browser
- [ ] Firewall เปิด 3000/3001 เฉพาะ Private และไม่เปิด 1433
- [ ] Restart Windows แล้ว Backend/Frontend กลับมาทำงาน และ Backend มีหนึ่ง instance

รายละเอียดกลไก cache/delta/SSE และกรณี restore/import อยู่ใน [REALTIME-SYNC.md](./REALTIME-SYNC.md)
