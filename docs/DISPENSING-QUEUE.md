# คู่มือติดตั้งและใช้งานคิวจ่ายยา

## การติดตั้ง

ฐานต้องมี Package Workflow และ Realtime SQL เดิม (`001`, `005`) ก่อนติดตั้ง
`backend/sql/009_dispensing_queue.sql`. SQL นี้เพิ่ม `TBLHOSPITALQUEUESTEP`,
`TBLDISPENSINGCHANNELCLAIMS`, คอลัมน์คิว/ช่องใน `TBLPACKAGEMASTER`,
`ACTION_ID` ใน `TBLPACKAGEEVENTS` และเปิด Change Tracking ให้ตารางใหม่
รันซ้ำได้ แต่ให้สำรองฐานและทดสอบกับฐานสำเนาก่อนนำขึ้น Live

บน Local:

```sh
cd backend
npm run db:dispensing:local
npm run db:package:validate:local
npm run db:realtime:validate:local
```

ตัวติดตั้งเครื่องใหม่ `JurapornWeb_install_fullstack.sql` รวม `009` แล้ว
ให้ใช้บัญชี SQL ที่มีสิทธิ์ติดตั้ง; บัญชี runtime ไม่ต้องมีสิทธิ์ DDL/DBA
บน Live ให้นำ SQL ไปตรวจและรันด้วยตนเอง **ห้ามใช้ seed และห้ามรัน migration
บน Live อัตโนมัติ** ติดตั้ง SQL ก่อน deploy Backend/Frontend รุ่นนี้ เพราะ API
ใหม่อ้างถึงคอลัมน์และตารางใหม่

ตั้งค่า `PACKAGE_WORKFLOW_ENABLED=true`. Callback ถูกปิดเป็นค่าเริ่มต้น
ทดสอบ Local ด้วย `HOSPITAL_CALLBACK_TEST_ENABLED=true` (development เท่านั้น)
หรือเปิด `HOSPITAL_QUEUE_CALLBACK_ENABLED=true` หลัง migration และตรวจเส้นทาง VPN
แล้ว การเปลี่ยน `.env` ต้องรีสตาร์ต Backend ไม่มี token/IP allowlist ในรอบนี้:
ปิดพอร์ตจากอินเทอร์เน็ตและจำกัดแหล่งที่ยิง POST ด้วย VPN/firewall

กำหนด credential สำหรับปุ่มปลดช่องค้างใน `.env.local` และ `.env.live`
โดยไม่ commit ค่าจริงลง Git:

```dotenv
DISPENSING_ADMIN_USERNAME=<admin-user>
DISPENSING_ADMIN_PASSWORD=<strong-password>
```

หลังเปลี่ยนค่าต้อง restart Backend รหัสถูกตรวจที่ Backend และไม่ถูกเก็บใน Browser

## กติกาคิว

Checking ส่งงานมา → package เข้าช่อง 1. ถ้า callback `04` มาแล้ว งานพร้อมทันที;
ถ้ายังไม่มี อยู่ “รอการเงิน/ประกัน”. Callback มาก่อน Checking ก็เก็บไว้รอ
`QUEUE_READY_AT` คือเวลาที่ทั้งสองเงื่อนไขครบ; เรียงจากเก่าไปใหม่ แล้วใช้
`PACKAGE_ID` ตัดสินเมื่อเวลาเท่ากัน. คิวเปิดอ่านข้ามวัน visit และไม่ถูกกรองด้วย
วันที่หน้า Verify. ประวัติกรองด้วยวันที่ **รับยา** (`RECEIVED_AT`)

หนึ่งช่องมีผู้ถือหนึ่ง session. token อยู่ใน `sessionStorage` ของแท็บนั้นเพื่อคืนช่อง
หลัง refresh; ไม่อยู่ใน URL, SSE หรือรายการคิว. การปิดแท็บหรือเครื่องดับ **ไม่ปล่อยช่อง**
ผู้ใช้ต้องกด “ปล่อยช่อง” เมื่อเลิกงาน. งานในช่องยังอยู่ แม้ไม่มีผู้ถือช่อง
หากผู้ดูแลกดปลดช่อง แท็บที่ถือช่องนั้นจะตรวจสิทธิ์จาก realtime update และทุก 5 วินาที
จากนั้นล้าง claim ในแท็บและกลับหน้าเลือกช่องอัตโนมัติ

เมื่อผู้ถือช่องปิดแท็บ ปิดเว็บไซต์ หรือรีเฟรชเอกสารทั้งหน้า Browser จะเรียก
`POST /api/v1/dispensing/channels/{channel}/claim/release-on-close` ผ่าน `sendBeacon`
เพื่อปล่อยช่องแบบ best-effort หากเครื่องดับหรือเครือข่ายขาดก่อนส่งสำเร็จ ช่องอาจยังค้างและต้องใช้เมนูผู้ดูแลปลดช่อง

ช่วยงานช่องอื่น: ผู้ถือช่องใหม่ดึง package มาได้ก่อนเรียกหรือหลัง Missed-call เท่านั้น
การย้ายไม่เปลี่ยนลำดับคิวและมี event ใน `TBLPACKAGEEVENTS`. ทุกคำสั่งแก้ไข
ตรวจ token ช่อง, row version และสถานะปัจจุบันใน transaction. ถ้ามีคนอื่นทำก่อน
API ตอบ 409 และหน้าจอโหลดแถวนั้นใหม่. `actionId` ป้องกันคำสั่งเดิมถูกประมวลผลซ้ำ

“เรียกผู้ป่วย” เรียกซ้ำได้และเพิ่ม `CALL_COUNT`; “Missed-call” ต้องเรียกก่อน
“ผู้ป่วยรับยาแล้ว” ปิด package ในระบบเราและย้ายไปประวัติ
แต่ละช่องเรียกค้างได้หนึ่ง VN เท่านั้น ต้องรับยาให้เสร็จหรือบันทึก Missed-call ก่อน
เรียก VN ถัดไป โดย Backend ตรวจซ้ำใน transaction จึงไม่อาศัยสถานะปุ่มบนหน้าจออย่างเดียว
รอบนี้ **ไม่เรียก** Finance/Insurance Update, Queue Call หรือ Queue Success
ของโรงพยาบาล การเรียก/ปิดเคสในเว็บจึงยังไม่เปลี่ยนคิวของโรงพยาบาล
หลังปิดระบบนี้ไม่แสดงคำเตือน แม้คิวโรงพยาบาลอาจยังเป็น `04`

## ช่องค้างและการตรวจสอบ

ผู้ดูแลฐานปลดช่องค้างด้วย `backend/sql/dispensing_release_stuck_channel.sql`
โดยกำหนด `@ChannelNo` และ `@Reason` ที่ระบุเหตุผลจริงก่อนรัน
สคริปต์ใช้ `RELEASED_AT`/`RELEASE_REASON` ในแถวเดิมเป็นหลักฐานย้อนหลัง
ห้ามลบแถว claim ตรง ๆ. ตรวจประวัติ:

สำหรับงานปกติสามารถกด “ปลดช่อง” ที่หน้าเลือกช่อง กรอก credential
และเหตุผล ระบบใช้ audit field เดียวกับ SQL recovery; SQL ใช้เป็นทางสำรองเมื่อเว็บหรือ
Backend เข้าไม่ได้

```sql
SELECT CHANNEL_NO, CLAIMED_AT, RELEASED_AT, RELEASE_REASON
FROM dbo.TBLDISPENSINGCHANNELCLAIMS ORDER BY CLAIMED_AT DESC;

SELECT VISIT_DATE, VN, STEP_ID, FIRST_READY_AT, LAST_RECEIVED_AT,
       RECEIPT_COUNT, APPLIED_WORKFLOW_ID
FROM dbo.TBLHOSPITALQUEUESTEP ORDER BY LAST_RECEIVED_AT DESC;

SELECT PACKAGE_ID, DISPENSING_CHANNEL, QUEUE_READY_AT,
       DISPENSING_PICKUP_STATUS, CALL_COUNT, RECEIVED_AT
FROM dbo.TBLPACKAGEMASTER
WHERE PAGE_NOW IN ('AWAITING_DISPENSING','DISPENSING','COMPLETE')
ORDER BY UPDATED_AT DESC;
```

## ข้อจำกัดและการตรวจรับ

- Callback `vn + visit_date + step_id` ไม่มี event ID. ระบบนับ callback ซ้ำและ
  ไม่เลื่อน `QUEUE_READY_AT` ใน workflow เดิม แต่ถ้า VN/วันเดียวกันมี workflow
  รอบใหม่ จะไม่สามารถแยก “callback ซ้ำที่ล่าช้าของรอบเก่า” จาก callback ใหม่
  ได้แน่นอน ต้องขอ event ID หรือ workflow reference จากโรงพยาบาลก่อนใช้งานเคสนี้จริง
- Realtime รุ่นนี้ใช้ Backend หนึ่ง instance และ SSE เส้นเดิม; หน้า Dispensing
  อ่าน summary delta และโหลดรายการยาราย package เมื่อเลือก ไม่อ่านใบยาทั้งหมดซ้ำ
- ก่อน Live ให้ทดสอบ callback ก่อน/หลัง Checking, ส่งซ้ำ, วันต่างกัน VN เท่ากัน,
  สองเครื่องแย่งช่อง, ย้ายพร้อมกัน, เรียกซ้ำ/Missed-call/รับยาแล้ว, คิวข้ามวัน,
  refresh/restart และการเชื่อมต่อ VPN ขากลับ การทดสอบ 50 เครื่องต้องทำใน
  สภาพแวดล้อมที่มีเครื่อง/โหลดจริง ไม่ใช่ผลจาก unit test
