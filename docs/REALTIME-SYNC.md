# คู่มือ Cache + Delta + Realtime

รุ่นแรก: Backend หนึ่ง instance, SQL Server, cache ในหน่วยความจำ browser เท่านั้น
ติดตั้งและทดสอบที่ Local แล้ว ไม่ได้รัน SQL หรือทดสอบกับ Live

## สิ่งที่เปลี่ยน

- เปิดคิวครั้งแรกได้ไม่เกิน 50 VN แล้วโหลดหน้าถัดไปเบื้องหลัง มีข้อความความคืบหน้าและจำนวนที่โหลดครบ
- Verify/Pending/Picking/Matching/Checking/Dispensing ใช้ store เดียวกัน ไม่ polling รายการเต็มแยกหน้า
- เมื่อข้อมูลเปลี่ยน โหลดเฉพาะ visit ที่กระทบ พร้อมทุก PN/ยา/คำเตือน/สถานะ แล้วแทนข้อมูล visit นั้น
- ใช้ SSE แจ้งการเปลี่ยนแปลง ไม่ส่งข้อมูลผู้ป่วยใน event และไม่สั่งเปลี่ยนหน้าของเครื่องอื่น
- ขณะ sync คงข้อมูลเดิม ช่องค้นหา ตำแหน่งเลื่อน และข้อความที่กำลังกรอก
- ขอล็อกสำเร็จก่อนเปิด PatientPanel; คนอื่นเปิดไม่ได้ และแถว VN แสดงเจ้าของล็อก
- ถ้าใบยาหรือคำเตือนเปลี่ยนระหว่างเปิด Panel ให้ปิด–เปิด PN เพื่อตรวจใหม่ก่อน Verify
- การกลับมาออนไลน์ไม่ replay คำสั่ง Verify/สแกน/เรียกคิว
- ไม่เปลี่ยนธีม สี DI/AI หรือกติกาส่งงานปกติ/ด่วน และไม่เพิ่มระบบล็อกอิน

## โครงสร้างและตำแหน่งแก้ไข

| ส่วน | ไฟล์/โฟลเดอร์ | หน้าที่ |
|---|---|---|
| Change Tracking | `backend/src/modules/realtime/change-tracking.repository.ts` | ตรวจ version/retention และหาคีย์ที่เปลี่ยนใน snapshot transaction |
| Snapshot/delta/SSE | `backend/src/modules/realtime/realtime.service.ts` | ชุดคีย์ที่ตรึงไว้, cursor, shared request, timer ร่วม, event |
| Routes | `backend/src/modules/realtime/realtime.controller.ts` | 4 endpoint ใหม่ |
| Source revision | `backend/src/modules/verify/source-revision.ts` | SHA-256 ของข้อมูลทั้ง visit รวม DI/AI |
| คำเตือนต้นทางแพ็กเกจ | `backend/src/modules/realtime/package-source-status.ts` | เปรียบเทียบกับ snapshot เดิม โดยไม่แก้ QR/ฉลาก |
| Transaction notification | `backend/src/database/database.service.ts` | แจ้ง realtime หลัง commit เท่านั้น |
| Cache/revision | `frontend/src/lib/realtime/cache.ts` | แทน visit, tombstone, revision และ lock expiry |
| Network lifecycle | `frontend/src/lib/realtime/store.ts` | snapshot, background, delta, SSE, reconnect |
| Hook/cache lifecycle | `frontend/src/hooks/useRealtimeQueue.ts` | ใช้ cache ตาม filter, หยุด connection เก่า, ล้างเมื่อ logout |
| Screens | `frontend/src/features/queue/PharmacyDashboard.tsx` | ส่งข้อมูลกลางให้หน้าคิว/Matching/Checking/Dispensing |

```text
SQL Server CT + invalidation triggers
  → ตัวตรวจร่วม Source ~5s / Workflow ~1s
  → SSE สัญญาณ version → /realtime/changes
  → shared read เฉพาะ visit → browser cache
  → คิวทุกขั้น + lock + จำนวนคิวที่สอดคล้องกัน

API บันทึก → ตรวจ transaction → COMMIT → ปลุกตัวตรวจ workflow ทันที
```

SSE/SQL Server CT เป็นเทคโนโลยีคนละส่วน: CT เก็บคีย์แถวที่เปลี่ยน ส่วน SSE ส่งสัญญาณไป browser
ตามแนวทาง [Microsoft Change Tracking](https://learn.microsoft.com/en-us/sql/relational-databases/track-changes/about-change-tracking-sql-server)
และ [NestJS SSE](https://docs.nestjs.com/techniques/server-sent-events)

## SQL ที่ต้องใช้

| ไฟล์ | ใช้เมื่อใด | ผลกระทบ |
|---|---|---|
| `backend/sql/005_enable_realtime_sync.sql` | ติดตั้ง realtime บน DB ที่มี schema เดิมครบแล้ว | CT, Snapshot Isolation, 1 helper table และ 2 trigger |
| `backend/sql/006_validate_realtime_sync.sql` | ตรวจหลังติดตั้ง/restore/import | อ่าน metadata และ THROW ถ้า CT/trigger/snapshot ไม่พร้อม |
| `backend/sql/007_rollback_realtime_sync.sql` | ถอด realtime หลังหยุดและย้อนรุ่นแอป | เอาเฉพาะสิ่งที่ feature เป็นผู้เปิดออกตาม marker |

ตารางที่เปิด CT: `TBLORX`, `TBLORXITEMS`, `TBLPATIENT`, `TBLMEDITEMSINFO`,
`TBLDOCTOR`, `TBLDEPT`, `TBLWORKFLOWMASTER`, `TBLPACKAGEPRESCRIPTIONS`,
`TBLPACKAGEMASTER`, `TBLPACKAGEITEMS`, `TBLREALTIMEINVALIDATIONS`

ตารางเพิ่มใหม่ **หนึ่งตาราง** คือ `dbo.TBLREALTIMEINVALIDATIONS`:

| Field | ความหมาย |
|---|---|
| `SCOPE_TYPE` | `PATIENT`, `MEDICINE` หรือ `GLOBAL` |
| `SCOPE_KEY` | HN, รหัสยา หรือ `ALL` |
| `TOUCHED_AT` | เวลาที่ invalidate ล่าสุด (UTC) |

PK คือ `SCOPE_TYPE + SCOPE_KEY` เก็บคีย์ล่าสุด ไม่ใช่สำเนาประวัติผู้ป่วย
Trigger `TR_TBLALLERGY_Realtime` บันทึก HN เก่าและใหม่ ส่วน `TR_DrugInteraction_Realtime`
บันทึกรหัสยาทั้งสองฝั่งจากทั้ง inserted/deleted รองรับ INSERT/UPDATE/DELETE หลายแถว
Trigger ไม่คำนวณ DI/AI และไม่เรียก API ภายใน transaction
ไม่ได้เพิ่ม PK หรือเปลี่ยนคอลัมน์เดิมของ TBLALLERGY

### ติดตั้ง Local

จากโฟลเดอร์ `backend/` ตรวจว่า `.env.local` ชี้ `localhost`/`127.0.0.1` และฐานที่ต้องการก่อน:

```bash
npm run db:realtime:local
npm run db:realtime:validate:local
npm run lint
npm test
npm run build
npm run start:dev:local
```

Frontend จากโฟลเดอร์ `frontend/`:

```bash
npm run lint
npm run test:realtime
npm run build
npm run dev
```

ถ้ามี Backend/Frontend รุ่นเก่ารันอยู่ ให้หยุดแล้วเริ่มใหม่เพื่อใช้ API และ cache รุ่นเดียวกัน
ไม่มี dependency ใหม่ที่ต้องติดตั้งสำหรับฟีเจอร์นี้

### นำไปใช้ Live ภายหลังด้วยตนเอง

1. สำรอง DB และตรวจ schema/สิทธิ์กับ DBA ก่อน ไม่รันชุดทดสอบที่สร้างข้อมูลสังเคราะห์บน Live
2. ถ้ามี source และ package workflow schema เดิมครบแล้ว รัน **005 แล้ว 006** ใน database ที่เลือกใน SSMS
3. ถ้ายังไม่มี package schema ให้เตรียม `001_create_package_workflow_schema.sql` และตรวจด้วย `003_validate_package_workflow.sql` ก่อน 005; ไม่ต้องนำ 002 ไป drop ข้อมูลโดยอัตโนมัติ
4. Deploy Backend/Frontend รุ่นนี้พร้อมกัน เพราะ Verify ต้องส่ง `expectedSourceRevision`
5. เริ่ม Backend เพียงหนึ่ง instance ด้วย profile Live แล้วตรวจ SSE/CT/คิวและ latency

005 รันซ้ำได้เมื่อ feature ติดตั้งสำเร็จแล้ว ถ้า DB มี CT อยู่ก่อนจะไม่แก้ retention ของระบบอื่น
ค่าเริ่มต้นกรณี feature เป็นผู้เปิด CT คือ 7 วัน + auto cleanup
ตารางที่ใช้ CT ต้องมี Primary Key เดิมอยู่ก่อน หากขาดจะหยุด ไม่สร้าง PK ให้เอง
ถ้าตารางเดิมเปิด CT แบบไม่เก็บ column mask ระบบยังอ่านได้ แต่ heartbeat อาจต้องโหลด visit เต็ม;
ให้ DBA ตรวจผล 006 และเปิด column tracking ตามความเหมาะสมเพื่อได้พฤติกรรม lock-only

SQL account ของแอปต้องมี SELECT/VIEW CHANGE TRACKING บนตารางที่ติดตาม และ metadata visibility
เพียงพอสำหรับตรวจ CT/trigger ส่วนผู้ติดตั้งต้องมีสิทธิ์ ALTER DATABASE/ALTER TABLE/สร้าง trigger
และแอปยังต้องมีสิทธิ์ workflow เดิม ไม่ควรให้สิทธิ์ DBA แก่ account runtime เพื่อแก้ปัญหานี้

### ย้อนกลับ

หยุด Backend และนำ Frontend/Backend กลับรุ่นก่อน realtime ก่อนรัน 007
007 ไม่ลบ source/workflow/package/patient records แต่ลบ helper/trigger ของ realtime
และถอด CT เฉพาะตารางที่ 005 ติด marker ว่าเป็นผู้เปิด
CT ระดับ DB จะปิดเฉพาะเมื่อ feature เปิดให้และไม่เหลือตารางอื่นใช้
Snapshot Isolation **ยังคงเปิดไว้** เพื่อไม่กระทบแอปอื่น; DBA ค่อยปิดเองหลังตรวจ dependency
ไฟล์ rollback ได้ตรวจโค้ด แต่ยังไม่ได้รันทดสอบถอดจริงบน Local นี้ เพื่อคงฟีเจอร์ที่ติดตั้งไว้

## วิธี sync และการป้องกันข้อมูลเก่าทับใหม่

ดู request/response ใน [API-CONTRACT.md](./API-CONTRACT.md#realtime-snapshot--delta--sse)

1. Subscribe SSE หนึ่ง connection และเริ่ม snapshot ตาม filter
2. Snapshot ตรึง date/VN keys ครั้งเดียว ให้ 50 กลุ่มแรก แล้ว background ใช้ page cursor เดิม
3. Cache ภายในแบ่ง bucket ตาม date/VN; PATIENTS ภายในยังแยก PATIENTID จึงไม่รวมคนละผู้ป่วย
4. รับ event แล้วเรียก delta ซึ่งแยก source/workflow cursor คนละตัวภายใน signed cursor
5. แทน visit ทั้งก้อนเมื่อ REVISION ใหม่กว่าหรือเท่ากัน; เก็บ empty bucket เป็น tombstone
6. Lock patch ใช้ revision แยกต่างหาก; heartbeat ไม่โหลดรายการยา/แพ็กเกจซ้ำ
7. Event ที่มาระหว่าง delta ยังไม่เสร็จจะตั้ง trailing sync เพื่อไม่พลาด commit ถัดไป

`REVISION` เป็น CT bigint string เปรียบเทียบด้วย BigInt ต่างจาก `SOURCE_REVISION`
ซึ่งเป็น hash ที่ยืนยันข้อมูลที่ผู้ใช้ตรวจ ห้ามใช้สองค่านี้แทนกัน
ไม่ให้ cursor ของ background page ย้อน live cursor
จำนวนใน snapshot เป็นจำนวน ณ ตอนตรึงคีย์ ส่วนจำนวนที่ UI แสดงหลังโหลดครบคำนวณจาก cache รวม delta

## การหลุด การสลับฐาน และ cache

- SSE heartbeat 15 วินาที ถ้า SSE เสียหรือไม่มีสัญญาณนานกว่า 30 วินาที ใช้ delta ทุก 5 วินาที
- ขณะปกติมี lightweight delta ทุกประมาณ 60 วินาทีเพื่อคง session (ไม่มีการอ่านรายการเต็มถ้าไม่เปลี่ยน)
- Cache อยู่ใน memory ไม่เก็บข้อมูลผู้ป่วยใน localStorage/IndexedDB; session identifier เดิมไม่ใช่ patient cache
- เปลี่ยนหน้าใช้ store เดิม เปลี่ยน filter ใช้ store อีกชุดและหยุด connection ชุดเก่า; cache ที่ไม่ใช้เกิน 5 นาทีจะถูกเก็บกวาดเมื่อเปลี่ยน filter
- ออกจากระบบล้าง cache; reload browser เริ่ม snapshot ใหม่
- DATASET_ID สร้างจาก profile/host/port/database และ `REALTIME_DATASET_EPOCH` โดยไม่ใส่ password
- ถ้า DATASET_ID เปลี่ยนจะทิ้งข้อมูลเก่าก่อนรับชุดใหม่ และไม่ส่ง lock token ข้ามฐาน
- SQL connection ไม่ถูกสลับขณะโปรเซสกำลังรัน: หยุด Backend เดิมแล้วเริ่ม `start:dev:local` หรือ `start:dev:live`; Frontend ยังใช้ API URL เดิมได้ถ้าพอร์ตเดิม
- ต่อกลับภายใน cursor lifetime จะตาม delta; หาก session หมดอายุ/Backend restart/CT cursor ใช้ไม่ได้ จะเริ่ม 50 VN ใหม่
- หากหลุดระหว่าง background จะเก็บ snapshot ID/page cursor และ retry หน้าที่ยังไม่เสร็จทุกประมาณ 5 วินาที โดยไม่โหลด 50 VN แรกใหม่; เมื่อ cursor นั้นหมดอายุจึง resnapshot
- รุ่นแรกเก็บ session/cursor signing secret ใน Backend memory จึง **ไม่ resume cursor เก่าข้าม restart** แต่กู้ด้วย resnapshot อัตโนมัติ
- ถ้า restore DB ที่ host/name เดิม ให้เปลี่ยน `REALTIME_DATASET_EPOCH` ใน environment deployment และ restart Backend เพื่อแยก generation

DB cursor ถูกตรวจเทียบ retention ภายใน SNAPSHOT transaction ตาม
[Microsoft: consistent change tracking reads](https://learn.microsoft.com/en-us/sql/relational-databases/track-changes/work-with-change-tracking-sql-server)
ไม่ได้เปลี่ยน isolation ของ SQL ทุกคำสั่งทั้งระบบ

## การทำงานพร้อมกันและคำเตือน

- ล็อก 5 นาที heartbeat 30 วินาที การหมดอายุแสดงตาม server clock; backend ยืนยันล็อกทุกครั้งที่บันทึก
- Offline หยุดการทำรายการและแสดง “ขาดการเชื่อมต่อ — ข้อมูลอาจไม่ล่าสุด” แต่ไม่ล้างข้อมูล/ข้อความ
- สูญเสียล็อกจะไม่ให้ทำงานต่อ ถ้ารายการถูกส่งไปขั้นอื่นแสดงสถานะใหม่และไม่เลือกคนถัดไปเอง
- Verify ตรวจ source revision ใน transaction; 409 ให้ sync เฉพาะ VN และผู้ใช้ตรวจใหม่
- token คืนเฉพาะเจ้าของตอนขอล็อก ไม่อยู่ใน SSE/คิว/heartbeat response
- แพ็กเกจที่สร้างแล้วไม่แก้ยา/QR/ฉลากอัตโนมัติ และไม่ย้าย workflow จากคำเตือน
- แพ็กเกจใหม่เก็บ hash ทั้ง visit ใน `TBLPACKAGEEVENTS.EVENT_DATA.sourceRevisionAtCreation` ของ event PACKAGE_CREATED เดิม
  จึงตรวจ PN/ยาเพิ่มแบบ backdate และแยกยาที่ไม่ได้เลือกในแพ็กเกจด่วนได้ โดยไม่เพิ่มตาราง/คอลัมน์อีก
  ไม่ใช่ audit ว่าเคยเปลี่ยนแล้วเปลี่ยนกลับ; เปรียบเทียบกับข้อมูลปัจจุบัน
- แพ็กเกจก่อนติดตั้งรุ่นนี้ไม่มี frozen visit hash: ใช้การเปรียบเทียบรายการที่มี snapshot และ timestamp ของรายการเพิ่มเป็น fallback
  ไม่สามารถรับรองการตรวจ PN ที่เพิ่มแบบ backdate ในแพ็กเกจเก่าได้ เพราะไม่มี baseline ทั้ง visit ตอนสร้าง
- กติกา soft-delete/cancel เดิมของ Verify ไม่ได้เปลี่ยนในรอบนี้; การลบแถวต้นทางจริงรองรับ delta
- หากลบ workflow/package child แบบ hard delete จน CT ไม่เหลือ parent key จะให้ resnapshot เพื่อไม่ทิ้งรายการค้าง
- Vital Signs/Subjective API แยกเดิมไม่ได้เพิ่ม Change Tracking ในรอบนี้ ไม่ควรตีความว่าทุก API ในระบบเป็น realtime แล้ว
- Location/payment gate ยังใช้พฤติกรรมเดิมที่ข้ามไว้ ไม่ได้เปิด gate ใหม่หรือเพิ่มสิทธิ์

## Bulk import / ปิด trigger / แทนตาราง

งานปกติให้เปิด trigger ตลอด และนำเข้าด้วย DML ที่ CT ติดตามได้
หากจำเป็นต้องปิด trigger, restore หรือแทนตารางทั้งชุด:

1. ทำใน maintenance window หยุดการทำรายการของผู้ใช้และ Backend ก่อน
2. นำเข้าข้อมูลแล้วคืน trigger/PK/CT ให้พร้อม ห้ามถือว่า CT ติดตามการเปลี่ยนที่เกิดตอนปิดไว้ได้
3. รัน 005 เมื่อจำเป็น และรัน 006 ตรวจอีกครั้ง
4. บันทึก GLOBAL invalidation ด้านล่างเพื่อบังคับ cursor รุ่นเดิม resync
5. หาก restore/เปลี่ยนตาราง ให้เปลี่ยน REALTIME_DATASET_EPOCH และ restart Backend; ให้ผู้ใช้ตรวจจำนวน/ข้อมูลหลังเริ่มใหม่

```sql
-- ใช้เฉพาะฐานที่ต้องการ invalidate หลังจบ maintenance
SET XACT_ABORT ON;
BEGIN TRANSACTION;
UPDATE dbo.TBLREALTIMEINVALIDATIONS WITH (UPDLOCK, SERIALIZABLE)
SET TOUCHED_AT = SYSUTCDATETIME()
WHERE SCOPE_TYPE = 'GLOBAL' AND SCOPE_KEY = N'ALL';
IF @@ROWCOUNT = 0
  INSERT INTO dbo.TBLREALTIMEINVALIDATIONS(SCOPE_TYPE, SCOPE_KEY)
  VALUES ('GLOBAL', N'ALL');
COMMIT;
```

ถ้า trigger ถูกปิดขณะทำงาน health check จะไม่รายงานว่าระบบพร้อม sync
หลังเปิดกลับต้อง invalidate เพราะไม่ทราบว่ามีข้อมูลใดพลาดไประหว่างปิด
ไม่ลบ helper ทั้งตารางเป็นกิจวัตร; ตารางนี้เก็บหนึ่งแถวต่อคีย์ ไม่ใช่ append event ทุกครั้ง

## Deployment และประสิทธิภาพ

- รุ่นนี้ใช้ Backend หนึ่ง instance เท่านั้น ไม่มี Redis/pubsub หรือ cursor store กลาง
- Reverse proxy ต้องไม่ buffer SSE และ timeout ยาวกว่า heartbeat; ตั้ง CORS ให้ตรง origin จริง
- เครื่องลูกข่ายต้องตั้ง `NEXT_PUBLIC_API_BASE_URL` ให้ชี้ Backend กลาง/route ของ reverse proxy ไม่ใช้ `localhost:3001` ของแต่ละเครื่องเอง; build Frontend ใหม่เมื่อเปลี่ยน public URL
- 50 browser = SSE 50 เส้น แต่ใช้ DB tracker ร่วม ไม่ใช่ 50 SQL polling timer
- shared request ใช้ทั้ง CT enumeration, filter scope และ visit hydration ลดคำขอเดียวกันที่มาพร้อมกัน
- หลัง commit เรียก workflow detector ทันที; timer 1 วินาทีเป็นทางเสริมเมื่อ detector กำลังทำงานอยู่
- ช่วงวันที่กว้างยังต้องอ่านรายการคีย์ทั้งหมดครั้งแรกและใช้ memory ตามจำนวน visit ที่ cache; ไม่ใช่ลดปริมาณ initial data เป็นศูนย์
- ยังต้องติดตาม SQL indexes/execution plan, tempdb version store, CT cleanup, memory และ response bytes บน workload จริง
- ยังไม่มี authentication ตามขอบเขตงานเดิม ไม่ควรเผยแพร่ API ต่ออินเทอร์เน็ตโดยไม่เพิ่มการยืนยันตัวตน/สิทธิ์

## การทดสอบ

จาก `backend/` หลัง build และติดตั้ง 005:

```bash
npm run test:realtime:local
```

สคริปต์บังคับ `.env.local` และปฏิเสธ DB_HOST ที่ไม่ใช่ localhost/loopback
เปิด Nest app ชั่วคราวและ SSE 50 client สร้างเฉพาะข้อมูลสังเคราะห์ แล้วลบเฉพาะข้อมูลชุดนั้นใน finally
ถ้าโปรเซสถูก kill แบบทันทีหรือฐานล่ม cleanup อาจทำงานไม่ครบ ต้องตรวจ test prefix จากรอบนั้นก่อนลบ ห้ามลบข้อมูลผู้ใช้ตาม wildcard กว้าง ๆ

ผลที่วัดและขอบเขตที่ยังไม่ได้ทดสอบอยู่ใน [REALTIME-TEST-REPORT.md](./REALTIME-TEST-REPORT.md)
