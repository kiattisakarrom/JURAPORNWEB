# API Contract

Base URL สำหรับเครื่องพัฒนา: `http://localhost:3001/api/v1`

API ชุดแรกเป็นแบบอ่านข้อมูลอย่างเดียว และรักษาชื่อ Field จากฐานข้อมูลไว้เป็นตัวพิมพ์ใหญ่

## Verify prescription list

ดึงข้อมูล Verify โดยจัดกลุ่ม `PATIENT → PRESCRIPTIONS → ITEMS` แต่แบ่งหน้าตาม visit โดยใช้ `PATIENTID + VISITDATETIME + VISITNUMBER` เพื่อให้หนึ่ง VN และทุก PN ภายใน VN อยู่ในหน้าเดียวกัน

```http
GET /verify/prescriptions?patientId={PATIENTID}&visitNumber={VISITNUMBER}&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&page=1&limit=20
```

Query parameters:

| Field | Required | Description |
|---|---:|---|
| `patientId` | Conditional | กรองด้วย `TBLORX.PATIENTID` ความยาวไม่เกิน 15 ตัวอักษร |
| `visitNumber` | Conditional | กรองแบบตรงกันทั้งหมดด้วย `TBLORX.VISITNUMBER` ความยาวไม่เกิน 10 ตัวอักษร |
| `fromDate` | Conditional | วันเริ่มต้นของ `TBLORX.CREATEDATETIME` รูปแบบ `YYYY-MM-DD` และต้องส่งพร้อม `toDate` |
| `toDate` | Conditional | วันสิ้นสุดของ `TBLORX.CREATEDATETIME` รูปแบบ `YYYY-MM-DD` และต้องส่งพร้อม `fromDate` |
| `page` | No | หน้าของรายการ visit ค่าเริ่มต้น 1 |
| `limit` | No | จำนวน VN ต่อหน้า 1–100 ค่าเริ่มต้น 20 |

ต้องส่ง `patientId`, `visitNumber` หรือช่วงวันที่อย่างน้อยหนึ่งรูปแบบ หากส่งหลายตัวกรอง ระบบจะใช้เงื่อนไขร่วมกันแบบ `AND`

Response `200 OK`:

```json
{
  "FILTER": {
    "PATIENTID": "{PATIENTID}",
    "VISITNUMBER": "{VISITNUMBER}",
    "FROMDATE": "2026-07-01",
    "TODATE": "2026-07-14"
  },
  "PAGINATION": {
    "PAGE": 1,
    "LIMIT": 20,
    "TOTAL_PATIENTS": 1,
    "TOTAL_VISITS": 1,
    "TOTAL_PAGES": 1
  },
  "PATIENTS": [
    {
      "PATIENTID": "{PATIENTID}",
      "FULLNAME_TH": "{FULLNAME_TH}",
      "PRESCRIPTIONS": [
        {
          "CREATEDATETIME": "2026-07-14T07:45:00.000Z",
          "VISITDATETIME": "2026-07-14",
          "VISITNUMBER": "{VISITNUMBER}",
          "PRESCRIPTIONNUMBER": "{PRESCRIPTIONNUMBER}",
          "SOURCE_REVISION": "SHA-256 64 ตัวอักษรของข้อมูล visit ที่ใช้ตรวจ",
          "CLINIC_CODE": "{CLINIC_CODE}",
          "LOCALWARDNAME": "{LOCALWARDNAME}",
          "DOCTOR": {
            "DOCTORCODE": "{DOCTORCODE}",
            "LOCALDOCTORNAME": "{LOCALDOCTORNAME}"
          },
          "ITEMS": [
            {
              "ITEMSEQ": 1,
              "CREATEDATETIME": "2026-07-14T08:30:00.000Z",
              "MEDICINECODE": "{MEDICINECODE}",
              "COMMERCIALNAME": "{COMMERCIALNAME}",
              "ORDERQTY": 1,
              "ORDERUNITCODE": "{ORDERUNITCODE}",
              "DOSEMEMO_TH": "{DOSEMEMO_TH}",
              "ALERTS": [
                {
                  "TYPE": "DI",
                  "STOCK_CODE": "1200000001",
                  "STOCK_NAME_EN": "Medicine A",
                  "WITH_STOCK_CODE": "1400000002",
                  "WITH_STOCK_CODE_NAME_EN": "Medicine B",
                  "SEVERITY_TYPE": 1,
                  "SEVERITY_TYPE_NAME": "Major",
                  "LEVEL_TYPE_NAME": "Established",
                  "EFFECTS_MEMO": "{EFFECTS_MEMO}",
                  "MANAGEMENT_MEMO": "{MANAGEMENT_MEMO}"
                },
                {
                  "TYPE": "AI",
                  "SIDE_EFFECT": "{SIDE_EFFECT}",
                  "ALLERGY_TYPE": "{ALLERGY_TYPE}",
                  "SEVERITY": "{SEVERITY}",
                  "REACTION": "{REACTION}",
                  "REMARKS": "{REMARKS}"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Examples:

```http
# ใบสั่งยาทั้งหมดของผู้ป่วยที่เลือก
GET /verify/prescriptions?patientId={PATIENTID}

# กรองด้วย VISITNUMBER
GET /verify/prescriptions?visitNumber={VISITNUMBER}

# ผู้ป่วยทั้งหมดในช่วงวันที่
GET /verify/prescriptions?fromDate=2026-07-01&toDate=2026-07-14&page=1&limit=20

# ผู้ป่วยที่เลือกภายในช่วงวันที่
GET /verify/prescriptions?patientId={PATIENTID}&fromDate=2026-07-01&toDate=2026-07-14

# ใช้ VISITNUMBER ร่วมกับผู้ป่วยและช่วงวันที่
GET /verify/prescriptions?patientId={PATIENTID}&visitNumber={VISITNUMBER}&fromDate=2026-07-01&toDate=2026-07-14
```

## Verify prescription

ดึงข้อมูลใบสั่งยา ผู้ป่วย แพทย์ และรายการยา โดยใช้ Composite Key ของ `TBLORX`

```http
GET /verify?visitDate=YYYY-MM-DD&visitNumber={VISITNUMBER}&prescriptionNumber={PRESCRIPTIONNUMBER}
```

Query parameters:

| Field | Required | Description |
|---|---:|---|
| `visitDate` | Yes | วันที่รับบริการรูปแบบ `YYYY-MM-DD` |
| `visitNumber` | Yes | `TBLORX.VISITNUMBER` ความยาวไม่เกิน 10 ตัวอักษร |
| `prescriptionNumber` | Yes | `TBLORX.PRESCRIPTIONNUMBER` ความยาวไม่เกิน 16 ตัวอักษร |

Response `200 OK`:

```json
{
  "CREATEDATETIME": "2026-07-14T07:45:00.000Z",
  "VISITDATETIME": "2026-07-14",
  "VISITNUMBER": "{VISITNUMBER}",
  "PRESCRIPTIONNUMBER": "{PRESCRIPTIONNUMBER}",
  "CLINIC_CODE": "{CLINIC_CODE}",
  "LOCALWARDNAME": "{LOCALWARDNAME}",
  "PATIENT": {
    "PATIENTID": "{PATIENTID}",
    "FULLNAME_TH": "{FULLNAME_TH}"
  },
  "DOCTOR": {
    "DOCTORCODE": "{DOCTORCODE}",
    "LOCALDOCTORNAME": "{LOCALDOCTORNAME}"
  },
  "ITEMS": [
    {
      "ITEMSEQ": 1,
      "CREATEDATETIME": "2026-07-14T08:30:00.000Z",
      "MEDICINECODE": "{MEDICINECODE}",
      "COMMERCIALNAME": "{COMMERCIALNAME}",
      "ORDERQTY": 1,
      "ORDERUNITCODE": "{ORDERUNITCODE}",
      "DOSEMEMO_TH": "{DOSEMEMO_TH}",
      "ALERTS": []
    }
  ]
}
```

Database relationships:

```text
TBLORX
  ├─ TBLORXITEMS       VISITDATETIME + VISITNUMBER + PRESCRIPTIONNUMBER
  ├─ TBLDOCTOR         DOCTORORDERCODE = DOCTORCODE
  ├─ TBLDEPT           CLINIC_CODE = DEPTCODE
  └─ TBLPATIENT        PATIENTID

TBLORXITEMS
  ├─ TBLMEDITEMSINFO   MEDICINECODE
  ├─ DrugInteraction   MEDICINECODE จับคู่กับ StockCode + WithStockCode ภายใน visit
  └─ TBLALLERGY        PATIENTID = HN และ MEDICINECODE
```

### Clinical alerts ใน Verify

`ITEMS[].ALERTS` เป็นคำเตือนแบบ read-only และไม่บล็อกขั้นตอน Verify:

- `DI` ตรวจยาทุก PN ภายใน visit เดียวกัน โดยยึด `VISITDATETIME + VISITNUMBER + PATIENTID`
- คู่ DI ต้องมีรายการยาสองรายการที่แตกต่างกัน และตรงกับ `DrugInteraction.StockCode` กับ `WithStockCode`
- ทั้งสองรหัสของคู่ DI ต้องเป็นตัวเลข 10 หลักและขึ้นต้นด้วย `12` หรือ `14`
- `STOCK_NAME_EN` มาจาก `DrugInteraction.EnglishName` และ `WITH_STOCK_CODE_NAME_EN` มาจาก `WithStockCodeNameEN`
- `SEVERITY_TYPE` ใช้กำหนดสีข้อความใน Frontend: `1` แดง, `2` ส้ม, `3` เขียว และค่าอื่นเป็นสีเทา
- `AI` ต้องตรงกันทั้ง `TBLALLERGY.HN = PATIENTID` และ `TBLALLERGY.MEDICINECODE = ITEMS[].MEDICINECODE`
- หากไม่พบคำเตือน API จะคืน `ALERTS: []`

## Patient with vital signs

ดึงข้อมูลผู้ป่วยพร้อม Vital Signs ล่าสุด เรียงจากใหม่ไปเก่า

```http
GET /patients/{patientId}?vitalSignLimit=20
```

Path and query parameters:

| Field | Required | Description |
|---|---:|---|
| `patientId` | Yes | `TBLPATIENT.PATIENTID` ความยาวไม่เกิน 15 ตัวอักษร |
| `vitalSignLimit` | No | จำนวน Vital Signs ตั้งแต่ 1–100 ค่าเริ่มต้น 20 |

Response `200 OK`:

```json
{
  "PATIENTID": "{PATIENTID}",
  "FULLNAME_TH": "{FULLNAME_TH}",
  "VITALSIGNS": [
    {
      "BODYWEIGHT": 60,
      "HEIGHT": 170,
      "BPSYSTOLIC": 120,
      "BPDIASTOLIC": 80,
      "TEMPERATURE": 36.5,
      "PULSERATE": 72,
      "RESPIRATIONRATE": 18,
      "O2SAT": 99,
      "CREATEDATETIME": "2026-07-14T08:30:00.000Z"
    }
  ]
}
```

Database relationship:

```text
TBLPATIENT.PATIENTID = VitalSign.PATIENTID
```

## Package workflow

API กลุ่มนี้จัดการสถานะตั้งแต่ Verify ถึง Dispensing โดยไม่แก้ข้อมูลใน
`TBLORX`, `TBLORXITEMS` หรือ `TBLORXITEMS_HISTORY`

เมื่อโปรไฟล์ฐานข้อมูลกำหนด `PACKAGE_WORKFLOW_ENABLED=false` เพราะยังไม่มีตาราง
Workflow, `GET /package-workflows` และ `GET /packages` จะตอบ `[]` ส่วน endpoint
รายละเอียดและคำสั่งเปลี่ยนสถานะจะตอบ `503 Service Unavailable` โดย API Verify
และ Patient ไม่ได้รับผลกระทบ

### Queue และ Package

```http
GET /package-workflows?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&limit=200
GET /package-workflows/{workflowId}
GET /packages?pageNow=MATCHING&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&limit=200
GET /packages/{packageId}
```

ตัวกรองที่รองรับ: `patientId`, `visitNumber`, `fromDate`, `toDate`, `limit` โดย
`pageNow` รองรับ `PICKING`, `MATCHING`, `CHECKING`, `AWAITING_DISPENSING`,
`DISPENSING`, `COMPLETE`

### Verify lease

```http
POST /package-workflows/verify-lock

{
  "visitDate": "2026-08-21",
  "visitNumber": "240001",
  "sessionId": "browser-session-id",
  "ownerName": "Pharmacist",
  "workstationCode": "VERIFY-WEB"
}
```

```http
POST /package-workflows/{workflowId}/verify-lock/heartbeat
DELETE /package-workflows/{workflowId}/verify-lock

{
  "lockToken": "UUID จาก verify-lock",
  "sessionId": "browser-session-id"
}
```

Lease มีอายุ 5 นาที และ client ควร heartbeat ทุก 30 วินาที

`VERIFY_LOCK.LOCK_TOKEN` ส่งเฉพาะ response การขอล็อกที่สำเร็จเท่านั้น
GET รายการ/รายละเอียด, heartbeat และ realtime จะส่ง `LOCK_TOKEN: null`
ห้ามนำ token ไปใส่ SSE, log หรือที่เก็บถาวรของ browser

Frontend ใหม่ใช้ `POST /package-workflows/{workflowId}/verify-lock/heartbeat?compact=true`
เพื่อรับเฉพาะ `{ WORKFLOW_ID, ROW_VERSION, VERIFY_LOCK }` โดยไม่อ่านรายการยา/แพ็กเกจซ้ำ
หากไม่ส่ง `compact=true` ยังคืนรูปแบบ workflow เดิม

### Auto-save NOTE ระดับ VN

```http
PUT /package-workflows/{workflowId}/verify-note

{
  "lockToken": "UUID จาก verify-lock",
  "sessionId": "browser-session-id",
  "note": "ข้อความไม่เกิน 1,000 ตัวอักษร",
  "actorName": "Pharmacist"
}
```

```json
{
  "WORKFLOW_ID": "UUID",
  "VERIFY_NOTE_DRAFT": "ข้อความล่าสุด หรือ null",
  "VERIFY_NOTE_UPDATED_AT": "2026-09-02T04:05:06.000Z"
}
```

NOTE เป็นข้อมูลร่วมระดับ workflow/VN และส่งค่าว่างเพื่อล้าง NOTE ได้ Endpoint นี้
ตรวจ `lockToken`, `sessionId`, วันหมดอายุของ lease, `IS_ACTIVE=1` และ
`CASE_STATUS=VERIFY` ภายใน transaction หากสิทธิ์หรือสถานะเปลี่ยนจะตอบ `409`
และไม่บันทึกข้อมูล

Workflow response และ realtime patch มี field เพิ่มดังนี้:

```json
{
  "VERIFY_NOTE_DRAFT": null,
  "VERIFY_NOTE_UPDATED_AT": null,
  "VERIFY_NOTE_UPDATED_BY": null
}
```

Frontend ควร debounce ประมาณ 800 ms และบันทึกแบบ single-flight เมื่อสร้าง
แพ็กเกจ Backend จะใช้ `note` ในคำสั่ง Verify ถ้ามี มิฉะนั้นใช้ draft ล่าสุด แล้ว
snapshot ไปยัง `TBLPACKAGEMASTER.VERIFY_NOTE` เพื่อแสดงต่อจนถึง Dispensing

### Auto-save NOTE ใน Matching และ Checking

```http
PUT /packages/{packageId}/note

{
  "note": "ข้อความไม่เกิน 1,000 ตัวอักษร",
  "actorName": "Pharmacist"
}
```

```json
{
  "PACKAGE_ID": "UUID",
  "VERIFY_NOTE": "ข้อความล่าสุด หรือ null",
  "UPDATED_AT": "2026-09-07T09:00:00.000Z"
}
```

Endpoint นี้แก้ `TBLPACKAGEMASTER.VERIFY_NOTE` ของแพ็กเกจที่ยัง active และอยู่
`MATCHING` หรือ `CHECKING` เท่านั้น ค่าว่างหมายถึงล้าง NOTE และตอบ `409` หาก
แพ็กเกจถูกส่งไปขั้นอื่นแล้ว Frontend debounce ประมาณ 800 ms, บันทึกแบบ
single-flight และ flush ข้อความล่าสุดก่อนปิด popup การ commit จะเข้า Change
Tracking/SSE เดิมเพื่อให้เครื่องอื่นได้รับ NOTE ล่าสุดโดยไม่โหลดรายการทั้งหมดใหม่

### Verify PN ปกติ/ด่วน

```http
POST /package-workflows/{workflowId}/verify

{
  "lockToken": "UUID",
  "sessionId": "browser-session-id",
  "prescriptionNumber": "01",
  "expectedSourceRevision": "ค่าจาก PRESCRIPTIONS[].SOURCE_REVISION ล่าสุดที่ผู้ใช้ตรวจ (64 hex)",
  "mode": "URGENT",
  "packagePriority": "URGENT",
  "selectedItems": [
    { "medicineCode": "1200000096", "itemSeq": 1 }
  ],
  "note": "ยาด่วน",
  "actorName": "Pharmacist",
  "idempotencyKey": "UUID ต่อการกดหนึ่งครั้ง"
}
```

`mode=NORMAL` ไม่ต้องส่ง `selectedItems`; Backend จะรอให้ทุก PN ใน VN ผ่าน
Verify แล้วสร้างแพ็กเกจรวมอัตโนมัติ ส่วน `mode=URGENT` ต้องส่งอย่างน้อยหนึ่งรายการ

`expectedSourceRevision` เป็น required field สำหรับ Verify ตั้งแต่รุ่น realtime
ใช้ SHA-256 ของข้อมูลทั้ง visit รวม PN/ยา/DI/AI ไม่ใช่เลข Change Tracking
ทุก PN ของผู้ป่วยภายใน visit เดียวกันได้ revision เดียวกัน
Backend ตรวจข้อมูลและล็อกใน transaction; หากต้นทางไม่ตรงกับ revision ให้ตอบ
`409 { "code": "SOURCE_CHANGED", "message": "..." }` โดยไม่บันทึก Verify รอบนั้น
Client ต้อง sync และให้ผู้ใช้ตรวจใหม่ ห้าม retry คำสั่งบันทึกเอง

### Pending และ stage transition

```http
POST /package-workflows/pending
POST /package-workflows/{workflowId}/return-to-verify
POST /packages/{packageId}/transitions

{ "action": "SEND_TO_MATCHING" }
{ "action": "SEND_TO_CHECKING" }
{ "action": "SEND_TO_DISPENSING" }
```

### Matching, Checking และ Dispensing

```http
POST /packages/{packageId}/matching/scan
{ "medicineCode": "1200000096" }

POST /packages/{packageId}/checking/validate-pair
{ "medicineCode": "1200000096", "labelQrToken": "QR-..." }

POST /packages/{packageId}/dispensing/status
{ "status": "CALLED_WAITING" }
{ "status": "RECEIVED" }
```

ทั้ง scan ที่ `MATCHED` และ `MISMATCHED` ถูกบันทึกใน `TBLPACKAGEEVENTS`
แต่เฉพาะค่าที่ตรงเท่านั้นที่เปลี่ยนสถานะรายการยา

## Realtime snapshot / delta / SSE

API อ่านคิวใหม่ใช้ร่วมกันสำหรับ Verify, Pending, Picking, Matching, Checking และ Dispensing
ต้องติดตั้ง `backend/sql/005_enable_realtime_sync.sql` ก่อน และเปิด Package Workflow
หาก CT/trigger ยังไม่พร้อม จะตอบ `503` แทนการแสดงข้อมูลว่าเป็น realtime ทั้งที่ไม่พร้อม
API อ่านเดิมยังคงอยู่ แต่หน้าคิวใหม่ไม่ polling รายการเต็มจาก API เหล่านั้นแล้ว

### เริ่มชุดข้อมูลและโหลดเบื้องหลัง

```http
POST /realtime/snapshots
Content-Type: application/json

{ "fromDate": "2026-08-31", "toDate": "2026-08-31" }

GET /realtime/snapshots/{SNAPSHOT_ID}?pageCursor={NEXT_PAGE_CURSOR}
```

ตัวกรอง optional: `patientId`, `visitNumber`, `fromDate`, `toDate`
ต้องมีช่วงวันที่ที่ครบคู่ หรือ patientId หรือ visitNumber อย่างน้อยหนึ่งแบบ
ใช้กติกาเดิม: source กรองด้วย `TBLORX.CREATEDATETIME`, workflow/package ด้วย `VISITDATETIME`
หนึ่งชุดตรึงรายการรหัส visit ไว้ ไม่ใช้ offset กับตารางที่กำลังเปลี่ยน
แต่ละหน้ามีไม่เกิน **50 กลุ่ม date + VN** พร้อมทุก PATIENTID/PN ภายในกลุ่มนั้น
Frontend แยกตัวผู้ป่วยด้วย `VISITDATETIME + VISITNUMBER + PATIENTID` ตามเดิม

```ts
type RealtimeResponse = {
  DATASET_ID: string;
  CURSOR: string;                    // opaque signed cursor; ไม่แกะหรือสร้างเอง
  UPSERTS: Array<{
    VISITDATETIME: string;
    VISITNUMBER: string;
    REVISION: string;                // CT bigint เป็น string ห้ามแปลงเป็น Number
    PATIENTS: VerifyPrescriptionPatient[];
    WORKFLOWS: PackageWorkflowResponse[];
    PACKAGES: PackageResponse[];
  }>;
  LOCKS: Array<{
    WORKFLOW_ID: string;
    REVISION: string;
    VERIFY_LOCK: PackageWorkflowResponse["VERIFY_LOCK"];
  }>;
  REMOVED_KEYS: Array<{ VISITDATETIME: string; VISITNUMBER: string }>;
  HAS_MORE: boolean;
  SNAPSHOT_ID?: string;
  PAGE_CURSOR?: string;
  NEXT_PAGE_CURSOR?: string | null;
  TOTAL_VISITS?: number;             // จำนวนรหัสใน snapshot เริ่มต้น ไม่รวม delta ภายหลัง
};
```

`UPSERTS` เป็น replacement ทั้ง visit ไม่ใช่ merge ยาทีละแถว; array ว่างเป็น tombstone
ที่มี revision ใช้ป้องกัน response เก่าทำให้รายการที่ลบกลับมา
`REMOVED_KEYS` ชี้ bucket ที่ว่าง โดยต้องใช้ revision ใน UPSERTS ประกอบเสมอ
Revision ของ LOCKS แยกจากข้อมูล visit และถูกตรวจอีกครั้งก่อนรวม
ทุก snapshot page คืน baseline cursor เดิม: **ห้ามนำ cursor ของ background page
ไปทับ live cursor ที่เดินหน้าไปแล้ว**

### ตามเก็บการเปลี่ยนแปลง

```http
GET /realtime/changes?cursor={CURSOR}
```

ส่ง response รูปแบบเดียวกัน แต่ไม่มี pagination ของ snapshot
เมื่อ `HAS_MORE=true` ใช้ CURSOR ใหม่โหลด delta ต่อจนหมด
ภายใน cursor แยก source กับ workflow และตรึงรายการของ delta window
Cursor ใช้ได้เฉพาะ snapshot session/database/backend instance ที่ออกให้
session ไม่มี activity เกิน 30 นาที, Backend restart, CT เก่ากว่า retention,
GLOBAL invalidation หรือ workflow hard-delete ที่ไม่เหลือ parent key จะตอบ
`409 { "code": "RESYNC_REQUIRED", "message": "..." }`
กรณีนี้เท่านั้นให้เริ่ม snapshot ใหม่ (หรือผู้ใช้กดรีเฟรชทั้งหมด)

### SSE

```http
GET /realtime/events
Accept: text/event-stream
```

```text
event: changed
data: {"DATASET_ID":"opaque-id","SOURCE_VERSION":"123","WORKFLOW_VERSION":"125","HEALTHY":true,"SERVER_TIME":"2026-08-31T00:00:00.000Z"}
```

มี event `status` เมื่อเชื่อมต่อ/สุขภาพเปลี่ยน/heartbeat ทุก 15 วินาที และ `changed`
เมื่อ tracker เดินหน้า ใช้ SSE เพียงหนึ่ง connection ต่อหน้าเว็บ ไม่ส่งข้อมูลผู้ป่วยหรือ lock token
Client เรียก changes ด้วย cursor ของตนเองหลังได้สัญญาณ ไม่ replay คำสั่ง Verify/scan
เมื่อ SSE ใช้ไม่ได้ให้ fallback delta ทุก 5 วินาที; ขณะปกติมี lightweight delta
อย่างน้อยทุกประมาณ 60 วินาทีเพื่อคง session และตรวจความสดใหม่ โดยไม่โหลดรายการเต็ม

### แพ็กเกจและต้นทาง

`PACKAGES[].SOURCE_CHANGED` และ `PACKAGES[].ITEMS[].ALERTS` เป็นข้อมูล projection
ใน realtime response เท่านั้น ไม่แก้ snapshot ยา/QR ที่บันทึกไว้
เมื่อพบความต่าง แสดง “ข้อมูลใบยาต้นทางเปลี่ยนหลังสร้างแพ็กเกจ”
แพ็กเกจใหม่เก็บ baseline hash ใน `TBLPACKAGEEVENTS.EVENT_DATA.sourceRevisionAtCreation`
ของ event `PACKAGE_CREATED` เดิมเพื่อรองรับรายการเพิ่มแบบ backdate โดยไม่เปลี่ยน schema
แพ็กเกจก่อนรุ่นนี้ใช้การเปรียบเทียบ snapshot รายการยาเป็น fallback ตามข้อจำกัดในคู่มือ
กติกา DI/AI และสีเดิมยังใช้เหมือนเดิม คำเตือนเองไม่ย้าย workflow หรือยกเลิกแพ็กเกจ

คู่มือติดตั้ง การทำงาน และข้อจำกัด: [REALTIME-SYNC.md](./REALTIME-SYNC.md)

## Errors

| Status | Meaning |
|---:|---|
| `400` | Parameter ไม่ครบหรือรูปแบบไม่ถูกต้อง |
| `404` | ไม่พบใบสั่งยาหรือผู้ป่วย |
| `409` | ล็อก/สถานะขัดแย้ง, SOURCE_CHANGED หรือ RESYNC_REQUIRED ตาม endpoint |
| `503` | Backend ยังเชื่อมต่อฐานข้อมูลไม่ได้ |

ระบบนี้ยังไม่มี Authentication จึงใช้สำหรับการพัฒนาในเครื่องเท่านั้น ห้ามเปิดให้เข้าถึงจากเครือข่ายภายนอกจนกว่าจะเพิ่มการยืนยันตัวตนและกำหนดสิทธิ์
