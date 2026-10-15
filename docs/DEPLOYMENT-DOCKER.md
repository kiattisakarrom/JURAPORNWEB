# รัน Frontend และ Backend ด้วย Docker

รองรับ Docker Engine/Docker Desktop แบบ **Linux containers** และ Docker Compose 2.30 ขึ้นไป
บน Windows/macOS/Linux ใช้ SQL Server ที่มีอยู่แล้ว ไม่สร้างฐานใหม่ ไม่รัน migration/seed
และไม่เชื่อมต่อ Live ระหว่าง build image

## สถานะ login ที่ต้องทราบก่อนใช้งานจริง

ปัจจุบัน `frontend/src/features/auth/AuthScreen.tsx` ตรวจ username/password `1 / 1`
ภายใน browser และ `WorkspaceApp.tsx` เก็บสถานะใน localStorage เท่านั้น
ยังไม่มี login API, session/token หรือการตรวจสิทธิ์ผู้ใช้บน backend สำหรับ API โดยรวม
Docker ไม่ได้เพิ่มระบบยืนยันตัวตนให้ และ `DISPENSING_ADMIN_*` ใช้เฉพาะการปลดช่องจ่ายยาค้าง

ก่อนให้ผู้ใช้จริงเข้าถึงข้อมูลผู้ป่วย ต้องเชื่อม login กับระบบบัญชีที่ตกลงใช้ เช่น
บัญชีโรงพยาบาล/SSO หรือฐานบัญชีของระบบ เพิ่มการตรวจ session/สิทธิ์ฝั่ง backend
และ HTTPS การตั้ง CORS หรือซ่อน port backend ไม่ได้ทดแทนการตรวจสิทธิ์
ชุด Docker นี้เริ่มต้นให้เข้าได้เฉพาะเครื่อง host เพื่อทดสอบ

นอกจากนี้บางหน้าที่ยังเรียกใช้อยู่มีข้อมูลจำลอง เช่น
`frontend/src/lib/patient-profile-api.ts` (Subjective/ประวัติและข้อมูลประกอบผู้ป่วย)
และ `frontend/src/lib/stock-check-api.ts` (stock เครื่อง)
ต้องเชื่อม API จริงหรือปิดส่วนที่ยังไม่พร้อมก่อนใช้งานทางคลินิก
การชี้ `DB_*` ไป Live ไม่ได้ทำให้ฟังก์ชัน mock เปลี่ยนเป็นข้อมูลจริง
การเพิ่ม Docker ครั้งนี้คงพฤติกรรมและ API contract เดิม ไม่ได้ทำระบบบัญชีหรือแทน mock เหล่านี้

ระหว่างตรวจเมื่อ 15 ตุลาคม 2026 `npm audit --omit=dev` ของ backend
รายงาน dependency 6 รายการ (critical 1, high 2, moderate 3)
รวม `proxy-addr` และ `multer` จึงควรตรวจเงื่อนไขที่กระทบแอปและอัปเดต dependency
พร้อมทดสอบก่อนเปิดใช้งานจริง Frontend รายงาน 6 รายการเช่นกัน
(critical 1, high 4, moderate 1 รวม `next`)
งาน Docker นี้ยังไม่ได้เปลี่ยน package-lock หรือแก้รายการ audit

## เส้นทางการเชื่อมต่อ

```text
Browser -> http://SERVER:3000
        -> /backend-api/api/v1/...
Next.js -> http://backend:3001/api/v1/...
NestJS  -> SQL Server ตาม DB_HOST / DB_PORT / DB_NAME
```

backend เชื่อมฐานเมื่อเริ่ม process ตาม environment ไม่ได้สลับ Local/Live ตอนกด login
ทุก browser ที่ใช้งาน backend instance เดียวกันจะใช้ฐานที่ตั้งไว้เดียวกัน

browser ใช้ URL เดียวกับหน้าเว็บ จึงไม่ต้องฝัง IP ของ server ใน JavaScript
และ frontend ไม่เชื่อมฐานข้อมูลโดยตรง Backend ไม่ publish port 3001 ออก host
REST และ SSE realtime ใช้ rewrite เดียวกัน

`frontend/next.config.ts` ใช้ `BACKEND_INTERNAL_URL` สำหรับปลายทาง rewrite
รันนอก Docker ยังคง default `http://127.0.0.1:3001`
Dockerfile ตั้งเป็น `http://backend:3001` และกำหนด `NEXT_PUBLIC_API_BASE_URL=/backend-api/api/v1`
ตอน build ค่าเหล่านี้อยู่ใน build output ถ้าจะเปลี่ยนต้องแก้การตั้งค่าตอน build แล้ว build image ใหม่
การย้ายชุด Compose เดิมไป server ใหม่ไม่ต้องเปลี่ยน URL นี้

## เตรียมเครื่องปลายทาง

1. ติดตั้ง Docker และเปิด Docker engine ใช้ Linux containers
2. นำ source มาที่เครื่องปลายทางด้วย Git หรือคัดลอก repository
3. คัดลอก `.env.docker.example` เป็น `.env.docker` ที่ root ของโปรเจกต์
   บน macOS/Linux ใช้ `cp .env.docker.example .env.docker`
   บน PowerShell ใช้ `Copy-Item .env.docker.example .env.docker`
4. แก้ `.env.docker` ให้ตรงกับเครื่องนั้น เก็บไฟล์นี้ไว้นอก Git

ค่าที่ต้องตรวจ:

| ค่า | วิธีตั้ง |
|---|---|
| `DB_HOST` | IP/hostname ของ SQL Server ที่ container เข้าถึงได้; ถ้าอยู่บน Docker host ใช้ `host.docker.internal` |
| `DB_PORT` | TCP port จริงของ SQL Server; named instance ต้องเปิด TCP และระบุ port ที่แน่นอน |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | ฐานและ SQL login ของ runtime account ที่มีสิทธิ์ตามงานจริง |
| `DB_PROFILE` | `local` หรือ `live` เพื่อระบุ profile; ไม่ได้โหลด `.env.live` จากเครื่อง host และไม่เปลี่ยน `DB_*` ให้อัตโนมัติ |
| `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE` | ตาม certificate/นโยบายของ SQL Server; ถ้ามี certificate ที่เชื่อถือได้ให้ใช้ `true` และ `false` ตามลำดับ |
| `PACKAGE_WORKFLOW_ENABLED` | เปิดเมื่อ schema พร้อม; ถ้า `false` งาน workflow จะใช้งานไม่ได้ |
| `REALTIME_DATASET_EPOCH` | เปลี่ยนหลัง restore/เปลี่ยนชุดฐานข้อมูลใต้ host/name เดิม |
| `FRONTEND_BIND_ADDRESS` | เริ่มต้น `127.0.0.1`; ทดสอบใน LAN ให้เปลี่ยนเป็น private IP ของ server ที่ต้องการเปิดรับ |
| `FRONTEND_PORT` | เริ่มต้น `3000` |
| `CORS_ORIGINS` | เช่น `http://PHARMA-SERVER:3000`; เส้นทาง browser ผ่าน Next.js ในชุดนี้เป็น same-origin |

`localhost` ใน container หมายถึง container นั้น จึงไม่ควรใช้เป็น `DB_HOST` สำหรับ SQL Server ที่อยู่นอก container
SQL Server ต้องเปิด TCP/IP และ firewall ต้องยอมให้ Docker host/container เข้าถึง
ถ้า Live ต้องผ่าน VPN ให้ตรวจว่า Docker network ใช้เส้นทาง VPN ได้ด้วย

Compose อ่าน backend environment ด้วย `format: raw` เพื่อรักษา `$` และ `#` ในรหัสผ่าน
เขียนรหัสผ่านตรง ๆ โดยไม่ครอบ quotes และห้ามมี newline ในค่า ถ้าต้องการตรวจ Compose
ให้ใช้ `config --quiet` เพราะ `config` ปกติอาจแสดง secrets ออก terminal

ฐานข้อมูลต้องติดตั้ง schema/migration ที่ตรงกับ source ก่อนเปิด workflow
ดู [คู่มือฐานข้อมูลและสิทธิ์ runtime](./DEPLOYMENT-WINDOWS-LAN.md)
ใช้ Installer account แยกจาก runtime account และรันการเปลี่ยนฐาน Live โดยผู้ดูแลเท่านั้น
ไม่มีการรัน SQL อัตโนมัติจาก container รวมถึงตอนอัปเดต

## Build และเริ่มทำงาน

รันจาก root ของ repository:

```bash
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail=100 backend frontend
```

เปิด `http://localhost:3000` บน host ตามค่าเริ่มต้น ถ้าเปลี่ยน bind address เป็น LAN IP
ให้เปิด `http://SERVER-IP:3000` จากเครื่องลูกข่าย และเปิด firewall เฉพาะเครือข่ายที่อนุญาต
ห้ามเปิดสู่อินเทอร์เน็ตขณะที่ยังใช้ mock login

backend ต้องเชื่อม DB สำเร็จก่อน frontend เริ่ม ถ้าเริ่มไม่ได้ให้ตรวจ DB_HOST, port,
VPN, SQL login และสิทธิ์จาก log โดยไม่เผยแพร่ข้อมูลผู้ป่วยหรือ credentials
healthcheck ตรวจ TCP readiness เท่านั้น ไม่ได้ตรวจ schema/Change Tracking ต่อเนื่อง

ทดสอบด้วยฐานสำเนาก่อน: เข้าเว็บ, เปิด Verify, ทดสอบ workflow และเปิดสอง browser
ตรวจ lock/realtime ตรวจ SSE ด้วยคำสั่งต่อไปนี้ (PowerShell ใช้ `curl.exe`):

```bash
curl -N http://localhost:3000/backend-api/api/v1/realtime/events
```

ควรเห็น event `status` ต่อเนื่อง; ถ้า `HEALTHY=false` ต้องตรวจ schema/Change Tracking
เมื่อทดสอบเสร็จกด Ctrl+C ถ้ารับผ่าน reverse proxy เพิ่มเติม ให้ปิด buffering สำหรับ SSE
และตั้ง timeout ให้รองรับ stream

ใช้ backend **หนึ่ง instance** เท่านั้น เพราะ realtime มี state ใน process
อย่าเปิด backend จาก npm/Task Scheduler ซ้ำกับ Compose ที่ต่อฐานเดียวกัน
`restart: unless-stopped` เริ่ม container ใหม่เมื่อ process ล้ม/engine กลับมา
เครื่องปลายทางต้องตั้ง Docker engine ให้เริ่มหลัง reboot ด้วย

ชุดนี้ไม่ publish hospital callback แยกออกมาและปิด callback เป็นค่าเริ่มต้น
ถ้าต้องเชื่อมระบบโรงพยาบาลภายหลัง ต้องกำหนดเส้นทาง proxy/VPN/firewall
และการยืนยันตัวตนของ callback ก่อนเปิด `HOSPITAL_QUEUE_CALLBACK_ENABLED`

## เมื่อ push Git จะอัปเดตไหม

**ยังไม่อัปเดตอัตโนมัติ** Git push ส่ง source ขึ้น repository
container ที่รันอยู่ใช้ image เดิม เครื่อง server ต้องดึง source และสร้าง/เปิด image ใหม่:

```bash
git pull --ff-only
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

ใช้ branch/release ที่ทดสอบแล้ว อัปเดตช่วงที่หยุดงานได้ เพราะการแทนที่ container
อาจตัดคำขอและ SSE ที่กำลังใช้งาน `.env.docker` เป็นของแต่ละเครื่องและไม่ถูกส่งผ่าน Git
ถ้ามี migration ใหม่ ให้อ่าน release และให้ผู้ดูแลเตรียมฐานก่อน deploy
การเปลี่ยน image ไม่ได้อัปเกรด schema ให้

ถ้าแก้เฉพาะ `.env.docker` ให้สร้าง container ใหม่เพื่อรับ environment ใหม่:

```bash
docker compose --env-file .env.docker up -d --force-recreate
```

`restart` อย่างเดียวไม่ได้โหลด environment ใหม่
หากต้องการ deploy ทุกครั้งหลัง push ต้องเพิ่ม CI/CD เช่น GitHub Actions:
รัน lint/test/build -> สร้าง image -> ส่ง registry -> ให้ server ดึง image และ deploy
เก็บ secrets ใน CI/server ไม่ใส่ Git และให้ runner เข้าถึง server ผ่านช่องทางที่องค์กรอนุญาต
repository นี้ยังไม่ได้เพิ่ม pipeline หรือเชื่อมเครื่องปลายทาง

## หยุดระบบ

```bash
docker compose --env-file .env.docker down
```

ฐาน SQL Server อยู่นอก Compose จึงไม่ถูกลบเมื่อหยุด container
Docker build context ใช้รายการอนุญาตเฉพาะ source/config ที่ต้องใช้
ไม่ส่ง `.env`, SQL scripts, backup, node_modules เดิม หรือเอกสารเข้า image

อ้างอิง: [Next.js standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output),
[Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables),
[Compose env_file](https://docs.docker.com/reference/compose-file/services/#env_file),
[Compose up](https://docs.docker.com/reference/cli/docker/compose/up/)
