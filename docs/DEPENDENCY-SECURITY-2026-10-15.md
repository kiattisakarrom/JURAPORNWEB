# ผลแก้ dependency security — 15 ตุลาคม 2026

แก้จากรายงาน `dependency-audit-2026-10-15.md` ที่ผู้ใช้ส่งมา โดยอัปเดต package.json
และ package-lock.json ทั้ง frontend/backend และตรวจซ้ำจาก lockfile ด้วย npm audit
ตัวเลขเป็นจำนวนแพ็กเกจที่ npm แจ้ง รวมแพ็กเกจแม่ที่พึ่งพาแพ็กเกจมีช่องโหว่
ไม่ใช่จำนวนช่องทางโจมตีที่แยกจากกัน และไม่ใช่ผลสแกน OS ของ Docker image

## ผล audit หลังแก้ไข

| ขอบเขต | รวมก่อนแก้ | Critical หลังแก้ | High หลังแก้ | Moderate หลังแก้ | รวมหลังแก้ |
|---|---:|---:|---:|---:|---:|
| Frontend ทั้งหมด | 14 | 0 | 5 | 0 | 5 |
| Frontend production (`--omit=dev`) | 6 | 0 | 0 | 0 | 0 |
| Backend ทั้งหมด | 11 | 0 | 0 | 0 | 0 |
| Backend production (`--omit=dev`) | 6 | 0 | 0 | 0 | 0 |

## การอัปเดต

- Frontend: Next.js และ eslint-config-next เป็น 16.4.1 ใน major 16 เดิม
  พร้อม dependency ที่มีแพตช์: sharp 0.35.5, postcss 8.5.23,
  baseline-browser-mapping 2.11.28, nanoid 3.3.20, source-map-js 1.2.2
  และ js-yaml 4.3.2
- Backend: @nestjs/common, core, platform-express และ testing เป็น 11.2.7
  ใน major 11 เดิม; mssql 12.7.7 ใช้ tedious 20.3.7 ซึ่งไม่ดึง sprintf-js มาใน runtime
- Backend dependency tree: multer 2.4.0, proxy-addr 2.0.8, qs 6.16.1,
  handlebars 4.7.10 และ js-yaml 4.3.2 รวมแพตช์ transitive dependencies อื่นใน lockfile
- Next.js สร้าง import ของ `root-params.d.ts` เพิ่มใน `frontend/next-env.d.ts`
  ตามรูปแบบ type declarations ของเวอร์ชันใหม่

Backend lockfile resolve ใหม่ภายใน version ranges ของ manifest เดิม/ที่อัปเดตข้างต้น
เพื่อให้ scoped override มีผลจริง แล้วติดตั้งใหม่ด้วย `npm ci` เพื่อทดสอบความทำซ้ำได้
ไม่มีการใช้ `npm audit fix --force` หรือ downgrade Next.js/Jest

## Scoped override ของเครื่องมือ coverage

`@istanbuljs/load-nyc-config@1.1.0` ยังขอ js-yaml สาย 3 ซึ่งดึง argparse 1 และ sprintf-js
ที่ไม่มีรุ่นแพตช์ตรงตัว จึงกำหนด override **เฉพาะลูกของแพ็กเกจนี้** ให้ใช้ js-yaml `^4.3.2`
ไม่ override sprintf-js และไม่บังคับ YAML รุ่นใหม่กับทุกแพ็กเกจโดยไม่ตรวจผู้ใช้

ตรวจ source ของ loader แล้วพบว่าเรียก API `js-yaml.load()` ซึ่งยังมีใน v4
เพิ่ม `backend/src/config/coverage-config.spec.ts` ทดสอบโหลด YAML, การ extends YAML อีกไฟล์,
การแปลงชื่อ check-coverage และการ normalize include แบบ scalar
พร้อมรัน Jest coverage จริงเพื่อยืนยัน integration นี้
หากเพิ่ม NYC YAML config ที่ใช้ schema/type พิเศษของ v3 ภายหลัง ต้องตรวจความเข้ากันได้เพิ่ม

## รายการที่ยังแก้ด้วย upstream release ไม่ได้

Frontend ยังมี dependency chain นี้เฉพาะเครื่องมือพัฒนา:

```text
eslint-config-next@16.4.1
  -> @next/eslint-plugin-next@16.4.1
  -> fast-glob@3.3.1
  -> micromatch@4.0.8
  -> braces@3.0.3
```

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
ระบุว่า braces <=3.0.3 ยังไม่มี patched version ณ วันที่ตรวจ
npm นับแพ็กเกจในสายนี้เป็น 5 high และเสนอ downgrade eslint-config-next เป็น 14.2.35
ซึ่งไม่เหมาะกับโปรเจกต์ Next.js 16 จึงยังไม่ทำตามข้อเสนอนั้น
รายงานนี้ไม่ได้ถือว่าช่องโหว่นี้แก้แล้ว และไม่ได้ปิด/กรองผล audit เพื่อซ่อนรายการ

ตรวจเส้นทางที่ใช้งาน: utility `get-root-dirs` ของ Next ESLint plugin ส่ง glob ไป fast-glob
เมื่อกำหนด `settings.next.rootDir` เป็น string/array เท่านั้น
eslint.config.mjs ของโปรเจกต์ไม่ได้กำหนดค่านี้ จึงใช้ cwd ตามค่าเริ่มต้น
ไม่พบการรับ glob จาก HTTP request หรือข้อมูลผู้ป่วยเข้ามาในเครื่องมือ lint
นี่เป็นการตรวจ reachability ของ config ปัจจุบัน ไม่ใช่หลักประกันทุกการใช้งานของ braces

ข้อจำกัดระหว่างรอ upstream:

- ใช้ config และ glob จาก repository ที่เชื่อถือได้ ไม่ส่ง pattern จากผู้ใช้/แหล่งภายนอกเข้า lint
- เครื่องมือ lint อยู่ใน dev dependencies/build stage; ตรวจ frontend standalone runtime image
  ที่สร้างใหม่แล้วไม่พบ braces หรือ eslint-config-next
- ตรวจ advisory และ Next ESLint plugin รุ่นใหม่ก่อนเปลี่ยน config/dependency chain นี้
- `npm audit` แบบรวม dev ของ frontend จะยังจบด้วย exit code 1 เพราะ 5 รายการนี้
  ส่วน production audit ต้องผ่านโดยไม่มีรายการ

## การตรวจสอบ

- Frontend: `npm run lint`, `npm run test:realtime` (20 tests), `npm run test:i18n` (9 tests)
  และ `npm run build` ผ่าน
- Backend: `npm ci`, `npm run lint`, `npm test` (44 tests), `npm run build`
  และ `npm run test:cov` (44 tests) ผ่าน
- Dockerfile ทั้งสอง build ผ่านด้วยแท็กทดสอบ `security-check`; backend ทั้ง build/runtime
  dependency install รายงาน 0 vulnerabilities
- ตรวจ frontend runtime image โดยไม่มี network พบ Next.js 16.4.1, postcss 8.5.23,
  sharp 0.35.5 และไม่พบเครื่องมือ lint ที่มี braces
- ทดสอบ Compose แยกด้วย backend จำลอง: หน้าเว็บ/static assets, API POST/query ผ่าน service DNS
  และ SSE ต่อเนื่องเกิน 30 วินาทีผ่าน โดยไม่เปิดพอร์ต host หรือเชื่อมฐานข้อมูล

ตรวจ audit ซ้ำได้จากแต่ละโฟลเดอร์:

```bash
npm audit --package-lock-only
npm audit --package-lock-only --omit=dev
```

## นำแพตช์ไปใช้งาน

การแก้ source/lockfile และการ build แท็กทดสอบไม่ได้อัปเดต container ที่กำลังใช้งาน
หลัง commit/push การแก้ไขและเตรียมช่วง deploy แล้ว ให้รันที่ server บน branch เดียวกัน:

```bash
git pull --ff-only
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

ตรวจ login และ workflow ด้วยฐานสำเนาก่อนนำขึ้น Live
งานนี้ไม่เปลี่ยน API contract, SQL, schema, login หรือข้อมูลผู้ป่วย
และไม่ได้ restart container เดิมหรือเชื่อมต่อฐาน Live

อ้างอิง: [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/),
[braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[source ของ load-nyc-config](https://github.com/istanbuljs/load-nyc-config/blob/v1.1.0/index.js)
