# Drug Master และตัวออกแบบสติกเกอร์ยา

## หน้าจอ

- `/drugmaster?tab=allergy` — เพิ่มข้อมูลแพ้ยาผู้ป่วย (Coming soon)
- `/drugmaster?tab=interaction` — จับคู่ยาอันตราย (Coming soon)
- `/drugmaster?tab=label` — ตัวออกแบบฉลากยา

ฉลากเริ่มต้นกว้าง 4 นิ้ว สูง 3 นิ้ว แนวนอนและใช้ Sarabun ที่ bundle มากับ Frontend
ไม่ต้องเชื่อม Google Fonts ผู้ใช้ลาก element เพื่อย้ายตำแหน่ง ลากมุมขวาล่างเพื่อปรับขนาด
และแก้ตำแหน่ง/ขนาด/ข้อความ/field/สี/เส้นขอบ/ลำดับชั้นจากแผงตั้งค่าได้

## Draft และ Active

- “บันทึก Draft” เก็บงานส่วนกลางแต่ยังไม่กระทบ Matching
- “บันทึกและใช้งาน” archive Active เดิมและสร้าง Active version ใหม่
- ทุกคำสั่งส่ง `ROW_VERSION`; ถ้ามีอีกเครื่องบันทึกก่อน API ตอบ `409` และผู้ใช้ต้องโหลดใหม่
- “คืนค่า Layout Active” นำ layout ที่ใช้งานจริงมาใส่ Draft ในหน้าจอ แต่ยังต้องกดบันทึก
- โลโก้รองรับ PNG/JPG ไม่เกิน 1 MB; asset เริ่มต้นเป็นเฉพาะตราสัญลักษณ์ที่
  `frontend/public/assets/juraporn-hospital-emblem.png` ส่วนชื่อโรงพยาบาลและเบอร์โทร
  เป็น Text element แยกกัน ไม่ฝังอยู่ในรูปภาพ

## Matching และการพิมพ์

1. สแกนรหัสยา ระบบระบุ `PACKAGE_ITEM_ID` เพื่อรองรับยารหัสเดียวกันหลายรายการ
2. Backend บันทึก Matching สำเร็จ รายการเปลี่ยนเป็น “สแกนแล้ว รอพิมพ์”
3. Frontend ขอ print model โดยใช้ Active template และเปิด Browser Print อัตโนมัติ
4. การพิมพ์ครั้งแรกจำ `LABEL_TEMPLATE_ID`; พิมพ์ซ้ำใช้ version เดิมแม้มี Active ใหม่
5. ส่ง Checking ได้เมื่อทุกรายการผ่าน Matching และฉลากเป็น `PRINTED`/`CHECKED`

QR ในฉลากสร้างจาก `QR_TOKEN` เดิมของ package item ข้อมูลจริงมาจาก package snapshot;
field ที่ไม่มีข้อมูลแสดง `—` การพิมพ์ทดสอบจากหน้าออกแบบใช้ข้อมูลตัวอย่างเท่านั้น

## ติดตั้งฐานข้อมูล

ฐานใหม่ใช้ `JurapornWeb_install_fullstack.sql` ซึ่งรวม migration 010 แล้ว ฐานเดิมให้รัน:

```bash
cd backend
npm run db:drug-labels:local
```

สำหรับ Live ใช้ `npm run db:drug-labels:live` เฉพาะเมื่อผู้ดูแลตรวจ profile และสั่งเอง
โปรเจกต์ไม่รัน migration หรือเปลี่ยนฐาน Live อัตโนมัติ

ฐานที่เคยรัน migration 010 รุ่นเดิมก่อนแยกข้อความออกจากรูปโลโก้ ให้รัน 010 รุ่นปัจจุบันซ้ำ:

```bash
npm run db:drug-labels:local
```

010 รุ่นปัจจุบันจะตรวจและอัปเกรดเทมเพลตเดิมแบบ idempotent โดยไม่เพิ่มข้อความซ้ำ
สำหรับ Live ใช้ `npm run db:drug-labels:live` โดยผู้ดูแลสั่งเองเท่านั้น
