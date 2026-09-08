# รายงานทดสอบ Realtime บน Local

ทดสอบวันที่ 31 สิงหาคม 2026 (เวลาไทย) — ไม่มีการเชื่อม/แก้ไข Live
รายงานนี้แยกสิ่งที่ทดสอบจริงออกจากเป้าหมาย ไม่ใช่การรับรองความเร็ว production

## ชุดทดสอบอัตโนมัติ

| ชุด | ผล |
|---|---|
| Backend lint | ผ่าน |
| Backend unit tests | 6 suites, 18 tests ผ่าน |
| Backend build | ผ่าน |
| Frontend lint | ผ่าน |
| Frontend realtime tests | cache 5 + store lifecycle 2 tests ผ่านทั้งหมด |
| Frontend build | ผ่าน; ต้องรันนอก sandbox เพราะ Turbopack เปิดพอร์ตภายในตอน compile CSS |
| SQL 005 ติดตั้ง Local | ผ่าน |
| SQL 005 รันซ้ำ | ผ่าน ไม่เพิ่ม helper ซ้ำ |
| SQL 006 validation | ผ่าน |
| SQL 007 rollback | ตรวจโค้ดแล้ว แต่ไม่ได้รันถอด feature จริง |

## 50-client integration/load smoke test

ใช้ `backend/scripts/test-realtime-local.js` เปิด Nest app ชั่วคราว, SSE 50 connections,
snapshot/delta clients 50 ตัว และ SQL Server Local จริง ไม่ได้จำลองฐานด้วย mock
สร้างเฉพาะข้อมูลสังเคราะห์ (HN/VN/ยา/AI/DI/workflow/package) และล้างใน finally
ผลที่ผ่าน:

- 50 client ไม่มีการเปลี่ยนแปลง: ไม่ hydrate รายการผู้ป่วย/ยาเต็มซ้ำ
- เพิ่ม VN แล้วทุก client ได้รายการเดียวกัน; เพิ่ม PN ใน VN เดิมแม้จำนวน VN เท่าเดิม
- แก้ยา/ลบยา/ลบ VN แล้วได้ replacement/tombstone ถูกต้อง
- AI, DI ข้าม PN, AI+DI, เปลี่ยน severity และลบคำเตือน
- ขอล็อกพร้อมกัน 10 ราย ได้เจ้าของ 1 ราย ที่เหลือ 409
- Heartbeat เป็น lock-only ไม่ดึงรายการยา; response คิว/heartbeat ไม่มี lock token
- ใช้ source revision เก่า Verify ได้ 409 และไม่สร้างแพ็กเกจ
- ปกติ PN เดียวส่งต่อทันที; หลาย PN รอ PN สุดท้าย; urgent เลือกเฉพาะยาได้
- ส่ง Pending/กลับ Verify และทุกขั้น Picking → Matching → Checking → Dispensing → Complete เห็นตรงกันทั้ง 50 client
- retry idempotency key เดิมไม่สร้างแพ็กเกจซ้ำ
- แก้ต้นทางหลังสร้างแพ็กเกจขึ้นคำเตือน แต่ quantity/QR เดิมใน package ไม่ถูกเขียนทับ
- baseline แพ็กเกจใหม่ตรวจ PN ที่เพิ่มแบบ backdate ได้ และไม่เตือนผิดจากยาเดิมที่ไม่ได้เลือกใน urgent
- เพิ่ม/ลบข้อมูลระหว่างโหลด background แบบ 50 VN ไม่ตกหล่นหรือซ้ำ
- Client หลุดแล้วกลับมาใช้ cursor เดิมรับ delta ได้
- Restart Nest app จริง: cursor เก่าได้ RESYNC_REQUIRED และเริ่ม snapshot 50 VN ใหม่ได้

Frontend cache unit tests ตรวจ response เก่าทับใหม่, deleted tombstone,
VN ซ้ำคนละวัน, DATASET_ID ต่างกัน และ lock revision/expiry
Backend unit test เพิ่มกรณี package baseline รองรับ PN เพิ่มแบบ backdate และ urgent ที่ไม่ได้เลือกยาทั้ง visit

## ผลวัดตัวอย่างหนึ่งรอบ

รอบสุดท้ายรวม frozen package revision และข้อมูลสังเคราะห์วันนี้เวลาไทย; วัดบน Local ของเครื่องพัฒนา:

| สิ่งที่วัด | ผล |
|---|---:|
| เพิ่ม VN → SSE ถึง 50 client | 4,019 ms |
| เพิ่ม VN → delta ถึงครบ 50 client | 4,087 ms |
| เริ่มคำสั่ง heartbeat → SSE ถึง 50 client | 54 ms |
| เริ่มคำสั่ง Pending → SSE ถึง 50 client | 285 ms |
| Snapshot ใหม่ 50 VN | 270 ms |
| API เดิม `/verify/prescriptions` 50 VN | 273 ms |
| Delta เมื่อไม่เปลี่ยน | 8 ms |
| Response snapshot ใหม่ 50 VN | 36,977 bytes |
| Response API เดิม 50 VN | 27,779 bytes |
| Response เปลี่ยนหนึ่ง VN ต่อ client | 987 bytes |
| Response delta ที่ไม่เปลี่ยน | 243 bytes |
| Hydration batch สำหรับหนึ่ง VN ที่ 50 client ขอพร้อมกัน | 1 |
| SQL request batches เมื่อ 50 client ขอ VN ที่เปลี่ยน | 15 |
| SQL request batches สำหรับ 100 idle delta requests | 14 |

นับ SQL request batch จาก `mssql.Request.query` ภายในโปรเซสทดสอบ
รวม CT/version/filter/read และ timer ร่วมในช่วงวัด ไม่ใช่จำนวน SQL statements ภายใน batch
เวลา heartbeat/Pending จับก่อนส่ง HTTP request จึงรวมเวลาประมวลผลก่อน commit ด้วย ไม่ใช่ timestamp ที่วัดจากจุด commit โดยตรง
ไม่รวม query ของแอปอื่นหรือ transaction control ของ driver
ก่อนแชร์ filter-scope query เคสหนึ่ง VN สำหรับ 50 client เคยใช้ 65 request batches ลดเหลือ 15 ในรอบข้างต้น

ข้อสรุป: จุดที่ดีขึ้นชัดคือ **ไม่โหลดข้อมูลเต็มซ้ำเมื่อไม่มีการเปลี่ยน และอ่าน VN ที่เปลี่ยนร่วมกัน**
ไม่ใช่ข้ออ้างว่า initial load ต้องเร็วกว่าเสมอ Snapshot ใหม่มี workflow/package เพิ่มด้วยจึง payload ใหญ่กว่า API source-only เดิม
ตัวเลขนี้เป็น smoke sample ไม่ใช่ p95/p99 และมีความแปรผันตาม workload/เวลาที่ชนรอบ timer

## ตรวจหน้าจอจริง

- เปิดสองแท็บด้วยข้อมูลสังเคราะห์ Local: แท็บแรกขอล็อกและเปิด Panel ได้ แท็บที่สองเห็นเจ้าของล็อกและไม่มี dialog เปิดขึ้นเมื่อพยายามเลือก
- หน้า Verify รับ VN ที่เพิ่มโดยสคริปต์เองโดยไม่ reload และช่องค้นหายังคงข้อความเดิม
- พิมพ์ NOTE ใน PatientPanel แล้ว sync/heartbeat: ข้อความยังอยู่
- หยุด Backend ทดสอบ: UI แสดงขาดการเชื่อมต่อ, ปุ่ม Verify disabled และ NOTE เดิมยังอยู่
- ตรวจ Desktop 1440px และ Mobile 390px: แถบสถานะ/คิวแสดงใน layout เดิม
- ระหว่าง restart ซ้ำพบ background หยุดหลังหน้าแรก จึงแก้ให้ retry จาก snapshot page cursor ที่ค้าง และเพิ่ม deterministic store test สำหรับกรณีนี้โดยตรง
- หลังแก้ retry ตรวจด้วย test/build; ไม่ได้จำลองการตัดเครือข่ายกึ่งกลางแต่ละหน้า background ซ้ำใน browser รอบสุดท้าย

## ขอบเขตและสิ่งที่ต้องทดสอบต่อก่อน production

- 50 ตัวเป็น API/SSE clients ในสคริปต์ ไม่ใช่ browser 50 เครื่องจริง
- ยังไม่ได้วัด frame time/long task/หน่วยความจำของ browser 50 เครื่องหรืออุปกรณ์รุ่นช้า
- ยังไม่ได้รันกับ Live/VPN, reverse proxy จริง, network latency สูง หรือ DB workload production
- สลับ DATASET_ID ทดสอบระดับ cache; ไม่ได้สลับเข้าฐาน Live จริงตามข้อห้ามของงานนี้
- CT retention หมดอายุทดสอบด้วย unit scenario ไม่ได้รอ 7 วันจริง
- ต้องทำ staging soak test และวัด p95 latency, SQL execution plan/query duration, tempdb, CT storage, response bandwidth และ browser responsiveness ก่อนรับรอง SLA
- แพ็กเกจก่อนรุ่นนี้ไม่มี frozen visit revision จึงมีข้อจำกัดการตรวจ PN เพิ่มแบบ backdate ตาม [คู่มือ](./REALTIME-SYNC.md)

## รันทดสอบซ้ำ

จาก `backend/`:

```bash
npm run lint
npm test
npm run build
npm run db:realtime:validate:local
npm run test:realtime:local
```

จาก `frontend/`:

```bash
npm run lint
npm run test:realtime
npm run build
```

สคริปต์ integration ปฏิเสธ non-local DB host, ไม่อ่าน `.env.live` และไม่เก็บ patient response ลงไฟล์ผลทดสอบ
สิ่งที่พิมพ์ออกมีเพียงผลตรวจ/จำนวน/ขนาด/เวลา ไม่มีข้อมูลผู้ป่วยหรือ secrets
