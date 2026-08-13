# Verify Prescriptions API Integration Report

วันที่ตรวจสอบ: 13 สิงหาคม 2026

## สรุปผล

Frontend หน้า Verify และ PatientPanel เชื่อมกับ API ต่อไปนี้แล้ว:

```http
GET http://localhost:3001/api/v1/verify/prescriptions
```

Frontend ไม่เชื่อมต่อฐานข้อมูลโดยตรง ข้อมูลทั้งหมดผ่าน Backend API เท่านั้น

โครงสร้างถูกแยกเป็น 3 ชั้นเพื่อให้แก้หรือขยายภายหลังได้ง่าย:

1. `src/lib/api-client.ts` — จัดการ Base URL, query string, `fetch` และ error กลาง
2. `src/lib/verify-prescriptions-api.ts` — กำหนดชนิดข้อมูลและเรียก Verify prescriptions API
3. `src/lib/verify-prescriptions-adapter.ts` — แปลง response ของ Backend เป็น model ที่หน้า Verify และ PatientPanel ใช้

Base URL เปลี่ยนได้ด้วย:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
```

หากไม่กำหนด env ระบบใช้ URL ข้างต้นเป็นค่าเริ่มต้น

## การจัดกลุ่มข้อมูลบนหน้า Verify

Backend ส่งข้อมูลเป็น:

```text
PATIENT
└── PRESCRIPTIONS
    └── ITEMS
```

Adapter จัดข้อมูลใหม่สำหรับหน้าเว็บเป็น:

```text
VN ของผู้ป่วย
├── PRESCRIPTIONNUMBER ใบที่ 1
│   └── ITEMS
└── PRESCRIPTIONNUMBER ใบที่ 2
    └── ITEMS
```

คีย์ของหนึ่ง VN ใน Frontend คือ:

```text
PATIENTID + VISITDATETIME + VISITNUMBER
```

จึงรองรับกรณีหนึ่งผู้ป่วยมีหลาย VN และหนึ่ง VN มีหลาย `PRESCRIPTIONNUMBER`

## Pagination

หน้า Verify จำกัดการแสดงผล 50 VN ต่อหน้า และจำนวนหน้าไม่ถูกกำหนดตายตัว

ข้อจำกัดสำคัญคือ Backend ปัจจุบันแบ่งหน้าตามจำนวน `PATIENTID` ไม่ใช่จำนวน VN:

- `PAGINATION.TOTAL_PATIENTS` นับผู้ป่วย
- `page` และ `limit` ของ API แบ่งตามผู้ป่วย
- ผู้ป่วยหนึ่งคนอาจมีหลาย VN

เพื่อให้หน้าเว็บแสดง 50 VN ต่อหน้าได้ถูกต้องในตอนนี้ Frontend จะ:

1. ดึง Backend ทีละไม่เกิน 100 ผู้ป่วย
2. ดึงหน้าที่เหลือเป็นชุด ชุดละไม่เกิน 4 request พร้อมกัน
3. รวมข้อมูลผู้ป่วยทั้งหมดในช่วงวันที่
4. แยกข้อมูลเป็นรายการระดับ VN
5. แบ่งหน้าใน Frontend หน้าละ 50 VN

แนวทางนี้ทำงานตรงตาม UI แต่หากเลือกช่วงวันที่กว้างมากอาจใช้หลาย request และหน่วยความจำมากกว่าที่ควร

ข้อเสนอสำหรับ Backend ในอนาคต:

- แบ่งหน้าตามคีย์ `PATIENTID + VISITDATETIME + VISITNUMBER`
- เพิ่ม `TOTAL_VISITS` และ `TOTAL_VISIT_PAGES`
- ส่ง VN พร้อม PN และ ITEMS ครบชุดภายในหน้าเดียว

เมื่อ Backend รองรับดังกล่าว Frontend เปลี่ยนเฉพาะ API client/adapter ได้ โดยไม่ต้องแก้ QueueTable หรือ PatientPanel

## Query filters

| Query | สถานะใน Frontend | การใช้งานปัจจุบัน |
|---|---|---|
| `fromDate` | ใช้งานแล้ว | ผูกกับปฏิทินวันเริ่มต้นบน Header |
| `toDate` | ใช้งานแล้ว | ผูกกับปฏิทินวันสิ้นสุดบน Header |
| `page` | ใช้งานใน API client | ใช้ดึงทุกหน้าของ Backend ตามจำนวนผู้ป่วย |
| `limit` | ใช้งานใน API client | ใช้ค่า 100 ต่อ Backend request; UI จำกัดแยกที่ 50 VN |
| `patientId` | รองรับใน API client | ยังไม่ผูกตรงกับช่องค้นหา เพราะช่องเดิมค้นได้ทั้ง HN, VN, ชื่อ และ PN |
| `visitNumber` | รองรับใน API client | ยังไม่ผูกตรงกับช่องค้นหา; ปัจจุบันค้นหา VN ในข้อมูลช่วงวันที่ที่โหลดมาแล้ว |

ช่องค้นหาบนหน้าเว็บยังทำ client-side search กับ `VN`, `PATIENTID/HN`, ชื่อผู้ป่วย และ `PRESCRIPTIONNUMBER` ภายในช่วงวันที่ที่เลือก

หมายเหตุ: `fromDate/toDate` ของ API กรอง `TBLORX.CREATEDATETIME` แต่คอลัมน์ “วันที่” บนหน้า Verify แสดง `VISITDATETIME` ทั้งสองค่านี้อาจไม่ใช่วันเดียวกันและควรยืนยันความหมายกับผู้ใช้งานระบบ

หากต้องการใช้ `patientId` หรือ `visitNumber` เป็น server-side filter ควรแยกช่องค้นหาให้ผู้ใช้ระบุชนิดข้อมูล หรือกำหนดรูปแบบ เช่น `HN:123456` และ `VN:240001` เพื่อไม่ให้ส่งทั้งสอง filter พร้อมกันแบบ `AND` โดยไม่ตั้งใจ

## Field mapping: ข้อมูลที่นำไปใช้แล้ว

| API field | ใช้ที่หน้าเว็บ | หมายเหตุ |
|---|---|---|
| `PATIENTS[].PATIENTID` | HN, ID ของแถว VN, PatientPanel | มีข้อสงสัยว่า `PATIENTID` เท่ากับ HN จริงหรือไม่ ดูหัวข้อคำถามที่ต้องยืนยัน |
| `PATIENTS[].FULLNAME_TH` | ชื่อ-นามสกุล, PatientPanel | ถ้าเป็น `null` แสดง “ไม่พบชื่อผู้ป่วย” |
| `PRESCRIPTIONS[].VISITDATETIME` | คอลัมน์วันที่, การจัดกลุ่ม VN | ใช้ร่วมกับ PATIENTID และ VISITNUMBER เป็นคีย์ |
| `PRESCRIPTIONS[].VISITNUMBER` | คอลัมน์ VN, PatientPanel | หนึ่ง VN รวมหลาย PRESCRIPTIONNUMBER |
| `PRESCRIPTIONS[].PRESCRIPTIONNUMBER` | PN ใน dropdown และ PatientPanel | แสดงค่าจริงเต็มรูปแบบ ไม่ตัดเหลือสองหลัก |
| `PRESCRIPTIONS[].CREATEDATETIME` | เวลา PN, เรียง VN ล่าสุดก่อน | แปลงเวลาเป็นเขตเวลา Asia/Bangkok |
| `PRESCRIPTIONS[].LOCALWARDNAME` | Ward / Clinic ใน PatientPanel | ใช้ก่อนข้อมูลดัมมี่ Patient Profile |
| `PRESCRIPTIONS[].DOCTOR.LOCALDOCTORNAME` | ชื่อแพทย์ใน PN และ PatientPanel | รองรับแพทย์ต่างกันในแต่ละ PN |
| `ITEMS[].MEDICINECODE` | รหัสยาหลังชื่อยาใน PatientPanel | แสดงรหัสตรงจาก API |
| `ITEMS[].COMMERCIALNAME` | ชื่อยาใน PatientPanel | ถ้าเป็น `null` ใช้ MEDICINECODE แทน |
| `ITEMS[].ORDERQTY` | จำนวนยา | ใช้ร่วมกับ ORDERUNITCODE |
| `ITEMS[].ORDERUNITCODE` | หน่วยของจำนวนยา | แสดง code ตรงจาก API ยังไม่มีชื่อหน่วยภาษาไทย |
| `ITEMS[].DOSEMEMO_TH` | คำอธิบายวิธีใช้ยา | รองรับ `\r\n` และแสดงหลายบรรทัด |

## Field ที่เก็บไว้แต่ยังไม่ได้แสดงโดยตรง

| API field | สถานะ | เหตุผล |
|---|---|---|
| `FILTER.PATIENTID` | ไม่แสดง | เป็น metadata ของ request |
| `FILTER.VISITNUMBER` | ไม่แสดง | เป็น metadata ของ request |
| `FILTER.FROMDATE` | ไม่แสดงจาก response | หน้าเว็บใช้ค่าจาก date picker อยู่แล้ว |
| `FILTER.TODATE` | ไม่แสดงจาก response | หน้าเว็บใช้ค่าจาก date picker อยู่แล้ว |
| `PAGINATION.PAGE` | ใช้ภายใน | ใช้โหลดหน้าของ Backend |
| `PAGINATION.LIMIT` | ใช้ภายใน | ใช้โหลดหน้าของ Backend |
| `PAGINATION.TOTAL_PATIENTS` | เก็บใน adapter | ยังไม่แสดง เพราะ UI นับ VN |
| `PAGINATION.TOTAL_PAGES` | ใช้ภายใน | ใช้หาจำนวน Backend request ที่ต้องโหลด |
| `PRESCRIPTIONS[].CLINIC_CODE` | เก็บใน model | UI แสดง LOCALWARDNAME แทน |
| `PRESCRIPTIONS[].DOCTOR.DOCTORCODE` | เก็บใน model | UI แสดงชื่อแพทย์ |
| `ITEMS[].ITEMSEQ` | เก็บใน modelและใช้สร้าง ID | ยังไม่มีคอลัมน์แสดงลำดับ |
| `ITEMS[].CREATEDATETIME` | เก็บใน model | ยังไม่มีส่วน UI ที่ต้องแสดงเวลารายการยา |

## ข้อมูลที่ API นี้ไม่มี แต่หน้าเว็บมีช่องรองรับ

| ข้อมูลบนหน้าเว็บ | สถานะปัจจุบัน |
|---|---|
| Priority | API ไม่มี จึงแสดง `—` และ PatientPanel แสดง “ไม่ระบุ Priority” |
| สถานะ workflow | API ไม่มี จึงกำหนดเป็น `verify` สำหรับข้อมูลชุดนี้ |
| แจ้งเตือน Duplicate / DI / Allergy / Stock | API ไม่มี จึงแสดงว่าไม่มีแจ้งเตือน โดยไม่ได้หมายความว่าตรวจแล้วว่าไม่มี |
| Duration | API ไม่มี จึงแสดง `—` |
| สถานะ Verify ของ PN | API ไม่มี checkbox จึงเป็น state ชั่วคราวใน Frontend และหายเมื่อ refresh |
| แหล่งจัดยา / เครื่องจัดยา | API ไม่มี จึงแสดง `—` ใน PatientPanel |
| น้ำหนัก ส่วนสูง BMI และ Vital Signs | ยังมาจากข้อมูลดัมมี่ `patient-profile-api.ts` |
| eGFR, Scr และค่า Lab | ยังมาจากข้อมูลดัมมี่ `patient-profile-api.ts` |
| Allergy / ADR | ยังมาจากข้อมูลดัมมี่/issue เดิม |
| Diagnosis | ยังมาจากข้อมูลดัมมี่ `patient-profile-api.ts` |
| Subjective / Medical Reconcile | ยังมาจากข้อมูลดัมมี่ `patient-profile-api.ts` |
| Renal / Drug Interaction | ยังมาจากข้อมูลดัมมี่ `patient-profile-api.ts` |
| Machine Stock Check | ยังมาจากข้อมูลดัมมี่ `stock-check-api.ts` |

ใน `docs/API-CONTRACT.md` มี API `GET /patients/{patientId}?vitalSignLimit=20` ซึ่งน่าจะใช้แทนน้ำหนัก ส่วนสูง และ Vital Signs บางส่วนได้ แต่ไม่ได้เชื่อมในงานรอบนี้ เพราะขอบเขตที่ระบุคือ Verify prescriptions API

ข้อมูลดัมมี่ของ stage `verify` จาก `mock-pharmacy.ts` ไม่ถูกนำมาแสดงในแท็บ Verify แล้ว ส่วนแท็บ workflow อื่นที่ API ชุดนี้ไม่รองรับยังคงใช้แหล่งข้อมูลเดิมเพื่อไม่ให้หน้าที่อยู่นอกขอบเขตงานเสียการทำงาน

## จุดที่ต้องยืนยันกับ Backend/ฐานข้อมูล

1. `PATIENTID` ต้องแสดงเป็น HN ใช่หรือไม่ หากไม่ใช่ ต้องเพิ่ม HN จริงใน response
2. `PRESCRIPTIONNUMBER` ต้องแสดงค่าทั้งหมด หรือให้ตัดเป็น PN สองหลักตาม UI เดิม
3. `ORDERUNITCODE` เป็นข้อความพร้อมแสดง หรือเป็น code ที่ต้อง join ตารางชื่อหน่วย
4. `CREATEDATETIME` ของใบสั่งยาเป็นเวลาที่ต้องแสดงในคอลัมน์ “เวลา” ใช่หรือไม่
5. `LOCALWARDNAME` เป็นค่าที่ถูกต้องสำหรับช่อง “Ward / Clinic” หรือควรแสดงร่วมกับ `CLINIC_CODE`
6. หาก VN เดียวมีหลายแพทย์ ควรแสดงแพทย์ระดับ PN ตามที่ทำอยู่ หรือใช้แพทย์หลักของ VN
7. รายการ `ITEMS` สามารถมี `MEDICINECODE` ซ้ำกันแต่ `ITEMSEQ` ต่างกันได้หรือไม่ ปัจจุบัน Frontendถือว่าเป็นคนละรายการ
8. Response list รับประกันหรือไม่ว่า PN/ITEMS ของผู้ป่วยใน Backend page จะครบและไม่เปลี่ยนขณะโหลดหน้าถัดไป
9. Date picker ควรกรองตาม `CREATEDATETIME` ตาม API ปัจจุบัน หรือควรกรอง/แสดง `VISITDATETIME` ให้เป็นวันเดียวกัน

## การจัดการ error

หน้า Verify แสดง error state พร้อมปุ่ม “ลองใหม่” เมื่อ:

- Backend ไม่ทำงาน
- CORS ไม่อนุญาต origin ของ Frontend
- API ตอบ status ที่ไม่สำเร็จ
- response ไม่ตรงกับ shape ขั้นต่ำที่คาดไว้

การทดสอบ endpoint จริงในวันที่จัดทำรายงานไม่สำเร็จ เนื่องจากไม่มี process ฟังที่ `localhost:3001` (`connection refused`) จึงยืนยันได้เฉพาะ TypeScript contract, adapter, lint และ production build แต่ยังไม่ได้ยืนยันข้อมูลจริงจากฐานข้อมูล

## ผลการตรวจสอบ Frontend

- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- TypeScript ผ่าน
- ไม่ได้แก้หรือเชื่อมฐานข้อมูลจาก Frontend
- ไม่ได้แก้ไฟล์ Backend ที่มีการเปลี่ยนแปลงค้างอยู่ก่อนเริ่มงาน
