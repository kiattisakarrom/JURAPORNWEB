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

### Verify PN ปกติ/ด่วน

```http
POST /package-workflows/{workflowId}/verify

{
  "lockToken": "UUID",
  "sessionId": "browser-session-id",
  "prescriptionNumber": "01",
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

## Errors

| Status | Meaning |
|---:|---|
| `400` | Parameter ไม่ครบหรือรูปแบบไม่ถูกต้อง |
| `404` | ไม่พบใบสั่งยาหรือผู้ป่วย |
| `503` | Backend ยังเชื่อมต่อฐานข้อมูลไม่ได้ |

ระบบนี้ยังไม่มี Authentication จึงใช้สำหรับการพัฒนาในเครื่องเท่านั้น ห้ามเปิดให้เข้าถึงจากเครือข่ายภายนอกจนกว่าจะเพิ่มการยืนยันตัวตนและกำหนดสิทธิ์
