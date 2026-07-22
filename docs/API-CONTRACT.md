# API Contract

Base URL สำหรับเครื่องพัฒนา: `http://localhost:3001/api/v1`

API ชุดแรกเป็นแบบอ่านข้อมูลอย่างเดียว และรักษาชื่อ Field จากฐานข้อมูลไว้เป็นตัวพิมพ์ใหญ่

## Verify prescription list

ดึงข้อมูล Verify โดยจัดกลุ่ม `PATIENT → PRESCRIPTIONS → ITEMS` การแบ่งหน้าจะนับตามจำนวนผู้ป่วย เพื่อให้ผู้ป่วยที่อยู่ในหน้าปัจจุบันได้รับใบสั่งยาและรายการยาครบใน Response เดียว

```http
GET /verify/prescriptions?patientId={PATIENTID}&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&page=1&limit=20
```

Query parameters:

| Field | Required | Description |
|---|---:|---|
| `patientId` | Conditional | กรองด้วย `TBLORX.PATIENTID` ความยาวไม่เกิน 15 ตัวอักษร |
| `fromDate` | Conditional | วันเริ่มต้นรูปแบบ `YYYY-MM-DD` และต้องส่งพร้อม `toDate` |
| `toDate` | Conditional | วันสิ้นสุดรูปแบบ `YYYY-MM-DD` และต้องส่งพร้อม `fromDate` |
| `page` | No | หน้าของรายชื่อผู้ป่วย ค่าเริ่มต้น 1 |
| `limit` | No | จำนวนผู้ป่วยต่อหน้า 1–100 ค่าเริ่มต้น 20 |

ต้องส่ง `patientId` หรือช่วงวันที่อย่างน้อยหนึ่งรูปแบบ หากส่งทั้งสองแบบ ระบบจะใช้เงื่อนไขร่วมกัน

Response `200 OK`:

```json
{
  "FILTER": {
    "PATIENTID": "{PATIENTID}",
    "FROMDATE": "2026-07-01",
    "TODATE": "2026-07-14"
  },
  "PAGINATION": {
    "PAGE": 1,
    "LIMIT": 20,
    "TOTAL_PATIENTS": 1,
    "TOTAL_PAGES": 1
  },
  "PATIENTS": [
    {
      "PATIENTID": "{PATIENTID}",
      "FULLNAME_TH": "{FULLNAME_TH}",
      "PRESCRIPTIONS": [
        {
          "VISITDATETIME": "2026-07-14",
          "VISITNUMBER": "{VISITNUMBER}",
          "PRESCRIPTIONNUMBER": "{PRESCRIPTIONNUMBER}",
          "DOCTOR": {
            "DOCTORCODE": "{DOCTORCODE}",
            "LOCALDOCTORNAME": "{LOCALDOCTORNAME}"
          },
          "ITEMS": [
            {
              "ITEMSEQ": 1,
              "MEDICINECODE": "{MEDICINECODE}",
              "COMMERCIALNAME": "{COMMERCIALNAME}",
              "ORDERQTY": 1,
              "ORDERUNITCODE": "{ORDERUNITCODE}"
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

# ผู้ป่วยทั้งหมดในช่วงวันที่
GET /verify/prescriptions?fromDate=2026-07-01&toDate=2026-07-14&page=1&limit=20

# ผู้ป่วยที่เลือกภายในช่วงวันที่
GET /verify/prescriptions?patientId={PATIENTID}&fromDate=2026-07-01&toDate=2026-07-14
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
  "VISITDATETIME": "2026-07-14",
  "VISITNUMBER": "{VISITNUMBER}",
  "PRESCRIPTIONNUMBER": "{PRESCRIPTIONNUMBER}",
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
      "MEDICINECODE": "{MEDICINECODE}",
      "COMMERCIALNAME": "{COMMERCIALNAME}",
      "ORDERQTY": 1,
      "ORDERUNITCODE": "{ORDERUNITCODE}"
    }
  ]
}
```

Database relationships:

```text
TBLORX
  ├─ TBLORXITEMS       VISITDATETIME + VISITNUMBER + PRESCRIPTIONNUMBER
  ├─ TBLDOCTOR         DOCTORORDERCODE = DOCTORCODE
  └─ TBLPATIENT        PATIENTID

TBLORXITEMS
  └─ TBLMEDITEMSINFO   MEDICINECODE
```

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

## Errors

| Status | Meaning |
|---:|---|
| `400` | Parameter ไม่ครบหรือรูปแบบไม่ถูกต้อง |
| `404` | ไม่พบใบสั่งยาหรือผู้ป่วย |
| `503` | Backend ยังเชื่อมต่อฐานข้อมูลไม่ได้ |

ระบบนี้ยังไม่มี Authentication จึงใช้สำหรับการพัฒนาในเครื่องเท่านั้น ห้ามเปิดให้เข้าถึงจากเครือข่ายภายนอกจนกว่าจะเพิ่มการยืนยันตัวตนและกำหนดสิทธิ์
