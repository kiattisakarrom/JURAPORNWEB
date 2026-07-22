# Project Instructions

- Frontend อยู่ใน `frontend/` และใช้ Next.js กับ TypeScript
- Backend อยู่ใน `backend/` และใช้ NestJS กับ TypeScript
- Backend เชื่อมต่อ Microsoft SQL Server ผ่าน environment variables เท่านั้น
- ข้อตกลง API กลางอยู่ที่ `docs/API-CONTRACT.md`
- ห้ามเชื่อมต่อฐานข้อมูลโดยตรงจาก Frontend
- SQL ทุกคำสั่งที่รับค่าจากผู้ใช้ต้องใช้ parameterized query
- ห้าม commit รหัสผ่าน, secrets, ข้อมูลผู้ป่วย, ไฟล์ `.env` หรือไฟล์สำรองฐานข้อมูล
- หลังแก้ Frontend ให้ตรวจด้วย `npm run lint` และ `npm run build` จากโฟลเดอร์ `frontend/`
- หลังแก้ Backend ให้ตรวจด้วย `npm run lint`, `npm test` และ `npm run build` จากโฟลเดอร์ `backend/`
- รักษาชื่อ field และโครงสร้างข้อมูลเดิม เว้นแต่ผู้ใช้สั่งให้เปลี่ยน
