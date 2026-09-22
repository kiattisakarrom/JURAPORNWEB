# ทดสอบ API รับแจ้งคิวจากโรงพยาบาลด้วย Postman

API นี้รับ `step_id=04` จากโรงพยาบาลและเก็บใน SQL Server ถ้า Checking ส่งงานแล้ว
คิวจะพร้อมเรียกบนหน้า Dispensing; ถ้ายังไม่ส่ง ระบบเก็บ callback ไว้รอ
ยังไม่เรียก API การเงิน/คิวของโรงพยาบาลออกไป

## เตรียม Backend

1. ติดตั้ง `backend/sql/009_dispensing_queue.sql` หลัง `005_enable_realtime_sync.sql`
   บนฐาน **Local** และตรวจด้วย `003_validate_package_workflow.sql` กับ
   `006_validate_realtime_sync.sql` ก่อนทดสอบ
2. ใน `backend/.env.local` ตั้ง `NODE_ENV=development`,
   `PACKAGE_WORKFLOW_ENABLED=true` และเพิ่ม:

   ```dotenv
   HOSPITAL_CALLBACK_TEST_ENABLED=true
   ```

   สำหรับ Live ต้องติดตั้ง migration ด้วยตนเองก่อน แล้วจึงใช้
   `HOSPITAL_QUEUE_CALLBACK_ENABLED=true`; ไม่เปิดอัตโนมัติ
   API ไม่มี token จึงต้องจำกัดพอร์ต/เส้นทางไว้ใน VPN และไม่เปิดสู่อินเทอร์เน็ต
3. รีสตาร์ต Backend ด้วย `npm run start:dev:local` ใน `backend/`

## ทดสอบ POST

ใน Postman ตั้ง Method เป็น `POST` และ URL เป็น
`http://localhost:3001/api/hospital/queue/step-id`

Header:

```http
Content-Type: application/json
```

Body → raw → JSON:

```json
{
  "vn": "0883",
  "visit_date": "2026-09-20",
  "step_id": "04"
}
```

หากสำเร็จจะได้ HTTP 200 พร้อม `success`, `message` และ `data` ซึ่งมี
`vn`, `visit_date`, `step_id` ตามรูปแบบตอบกลับของ API โรงพยาบาล
ระบบเก็บเวลารับครั้งแรก/ล่าสุดและจำนวนครั้งไว้ใน SQL Server ให้ตรวจผ่าน GET ด้านล่าง
รับเฉพาะสาม field นี้ ไม่ต้องส่ง `status_id` (`status_id` เป็นเรื่องการเรียกคิว)
การส่ง `step_id` ที่ไม่ใช่ `04` หรือวันผิดรูปแบบจะได้ HTTP 400;
หากยังไม่เปิด callback หรือยังไม่ได้ติดตั้ง migration จะได้ HTTP 503/ข้อผิดพลาดฐานข้อมูล

## ตรวจว่าระบบรับข้อมูลจากเครื่องอื่นแล้ว

ใน Postman เรียก `GET`
`http://localhost:3001/api/hospital/queue/step-id/recent`
จาก Postman **บนเครื่อง Backend เท่านั้น** จะเห็นรายการที่ Backend ได้รับล่าสุด
หากเรียก GET จากเครื่องอื่นจะได้ HTTP 403

หากโรงพยาบาลเป็นผู้ส่ง request เข้ามา ให้ใช้ URL ของเครื่อง Backend ที่เขา
เข้าถึงได้แทน `localhost` เช่น
`http://<BACKEND_LAN_IP>:3001/api/hospital/queue/step-id` และเปิด
การเชื่อมต่อเครือข่าย/ไฟร์วอลล์สำหรับพอร์ต 3001 **เฉพาะต้นทางที่ตกลงกัน**
Postman บนเครื่องโรงพยาบาลใช้ `localhost` ไม่ได้ เพราะจะชี้กลับไปยังเครื่องของเขาเอง
การที่เครื่องคุณต่อ VPN แล้วเรียก API โรงพยาบาลได้ ไม่ได้ยืนยันว่าเครื่องของ
โรงพยาบาลจะเชื่อมกลับมาหาเครื่องคุณได้ ต้องให้ทีมเครือข่ายทดสอบเส้นทางขากลับด้วย

ก่อนใช้งานจริง ให้ยืนยันกับทีมโรงพยาบาลเรื่อง field, authentication,
URL/HTTPS, การ retry และวิธีแยก callback ของ VN+วันเดียวกันที่มี workflow รอบใหม่
เนื่องจาก payload สาม field นี้ไม่มี event ID จึงแยก callback ซ้ำที่ส่งช้าจาก callback
ของรอบใหม่ไม่ได้อย่างสมบูรณ์ ดูคู่มือ [DISPENSING-QUEUE.md](./DISPENSING-QUEUE.md)
