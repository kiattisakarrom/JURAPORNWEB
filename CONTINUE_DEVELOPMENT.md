# JurapornWeb — คู่มือทำงานต่อจากระบบเดิม

> ไฟล์นี้ใช้เป็น Development Handoff สำหรับส่งต่อให้ Developer หรือ AI Agent เพื่อพัฒนาระบบต่อ โดยไม่ต้องวิเคราะห์โครงสร้างใหม่ตั้งแต่ต้น

## 1. คำสั่งเริ่มต้นสำหรับผู้รับช่วงงาน

ก่อนแก้ไขโค้ด ให้ดำเนินการตามลำดับนี้:

1. อ่าน `ARCHITECTURE_REVIEW.md` ให้ครบก่อนเริ่มงาน
2. ตรวจสอบ `git status` และรักษาการแก้ไขเดิมของผู้ใช้
3. อ่านเฉพาะ feature และ dependencies ที่เกี่ยวข้องกับงานใหม่
4. ห้ามเปลี่ยน Theme/UI เดิม เว้นแต่ได้รับคำสั่งชัดเจน
5. พัฒนาทั้ง Mobile และ Desktop พร้อมกัน
6. หลังแก้ไขต้องรัน `npm run lint` และ `npm run build`
7. สรุปไฟล์ที่แก้ เหตุผล ผลกระทบ และผลการตรวจสอบทุกครั้ง

## 2. Project Context

JurapornWeb หรือ PharmAuto OPD เป็น Frontend Prototype สำหรับระบบห้องจ่ายยาผู้ป่วยนอก พัฒนาด้วย:

- Next.js 16
- React 19
- TypeScript แบบ strict
- Tailwind CSS 4
- TanStack Query
- shadcn-style UI primitives
- Lucide React icons
- Mock API และ mock data ภายในโปรเจกต์

ระบบปัจจุบันเป็น Single-page Workstation ใช้ React state ควบคุมการเปลี่ยนหน้าภายใน URL เดียว

## 3. โครงสร้างระบบที่ต้องรู้

### Main application

- `src/app/page.tsx` — Auth gate
- `src/features/queue/PharmacyDashboard.tsx` — Application shell และ screen controller
- `src/features/shell/SidebarNav.tsx` — Desktop sidebar / Mobile bottom navigation
- `src/features/shell/WorkspaceHeader.tsx` — Header, search, summary และ logout

### Main screens

- `src/features/auth/AuthScreen.tsx`
- `src/features/dashboard/OperationsDashboard.tsx`
- `src/features/workflow/MatchingCheckingScreen.tsx`
- `src/features/dispensing/DispensingQueueScreen.tsx`
- `src/features/medication-error/MedicationErrorScreen.tsx`

### Queue และ workflow popups

- `src/features/queue/QueueTable.tsx`
- `src/features/queue/MobileQueueList.tsx`
- `src/features/verify/PatientPanel.tsx`
- `src/features/matching/MatchingPopup.tsx`
- `src/features/checking/CheckingCheckoutPopup.tsx`
- `src/features/dispensing/DispensingPopup.tsx`
- `src/features/patient-profile/PatientProfilePopup.tsx`

### Data layer

- `src/types/pharmacy.ts` — Domain types หลัก
- `src/lib/mock-pharmacy.ts` — Queue fixtures
- `src/lib/pharmacy-api.ts` — Queue และ checkout APIs
- `src/lib/workstation-api.ts` — Workflow, dashboard และ ME APIs
- `src/lib/patient-profile-api.ts` — Patient profile API
- `src/lib/stock-check-api.ts` — Machine/stock API

## 4. Theme Preservation Contract

ข้อกำหนดนี้เป็นกฎบังคับสำหรับงานพัฒนาต่อ:

### สีหลัก

| ความหมาย | สีเดิม |
|---|---|
| Workspace background | `#eef1f5` |
| Navigation | `#0f1f3d` |
| Navigation active | `#1d3461` |
| Primary / Verify | `#2f6bf3` |
| Success / Complete | `#16a34a` |
| Warning / Matching | `#e07d12` |
| Danger / Stat / Error | `#d83a3a` |
| Dispensing | `#0a8bb0` |
| Picking | `#7a5cff` |

### กฎ UI

- ใช้พื้นหลังเทาอ่อนและ panel/card สีขาว
- ใช้ border บางและ shadow เบา
- ใช้มุมโค้ง `rounded-xl`, `rounded-2xl` หรือ `rounded-3xl`
- ใช้ Lucide icons ต่อเนื่อง ห้ามผสม icon style อื่นโดยไม่จำเป็น
- ใช้ `font-mono` สำหรับ VN, HN, เวลา, จำนวน และรหัสต่าง ๆ
- ใช้สีสถานะตามความหมายเดิม ห้ามสลับ semantic color
- ใช้ `Button`, `Input` และ `Badge` จาก `src/components/ui/` ก่อนสร้าง component ใหม่
- ห้ามเปลี่ยน font stack, navigation style, card language หรือ spacing scale เดิม
- หน้า Auth สามารถใช้ gradient เดิมได้ แต่หน้า Workstation ไม่ควรเพิ่ม gradient ตกแต่งใหม่

## 5. Responsive Rules

ทุก feature ใหม่ต้องรองรับอย่างน้อย:

| Viewport | สิ่งที่ต้องตรวจ |
|---|---|
| 360×800 | Mobile ขนาดเล็ก, bottom nav, popup, table overflow |
| 390×844 | Mobile ทั่วไปและ safe area |
| 768×1024 | Tablet และ 2-column layout |
| 1366×768 | Desktop ความสูงจำกัด |
| 1920×1080 | Large desktop |

แนวทางที่ต้องรักษา:

- ใช้ `dvh` กับ application shell และ fullscreen overlay
- รองรับ `env(safe-area-inset-bottom)` สำหรับ navigation/footer ที่ชิดขอบจอ
- ห้ามบีบ desktop table ลง Mobile ให้เปลี่ยนเป็น card หรืออนุญาต horizontal scroll
- Master/detail บน Mobile ต้องมี scroll area แยกกันอย่างชัดเจน
- Action buttons ต้อง stack ได้บนจอแคบ
- หลีกเลี่ยง fixed width ที่กว้างกว่า Mobile viewport
- Touch target ควรมีขนาดประมาณ 40–44px ขึ้นไป
- ข้อความสำคัญห้ามถูก `truncate` โดยไม่มีทางดูข้อมูลเต็ม

## 6. Architecture Rules

### Component responsibilities

- Screen component: ควบคุม layout และ feature-level state
- UI component: แสดงผลจาก props และไม่เรียก API โดยไม่จำเป็น
- API function: อยู่ใน `src/lib/` หรือ data layer ของ feature
- Shared domain type: อยู่ใน `src/types/`
- Style mapping ที่ใช้หลาย component: แยกเป็นไฟล์กลาง เช่น `queue-ui.tsx`

### Data fetching

- ใช้ TanStack Query สำหรับ asynchronous/server-like state
- Query key ต้องระบุ resource และ entity ID ให้ชัดเจน
- ห้ามเรียก API ซ้ำด้วย query key คนละชื่อหากเป็นข้อมูลชุดเดียวกัน
- ต้องมี Loading, Empty และ Error state
- Mutation ต้องกำหนดผลสำเร็จ/ล้มเหลวและการ invalidate query

### State management

- ใช้ local state สำหรับ state ที่อยู่เฉพาะ component
- ห้ามเพิ่ม global state library หาก React state/URL/TanStack Query ยังเพียงพอ
- Screen หรือ filter ที่ต้องรองรับ refresh/back button ควรย้ายไป URL state

## 7. สิ่งที่ยังเป็น Prototype

ผู้พัฒนาต้องทราบว่าส่วนต่อไปนี้ยังไม่ใช่ production implementation:

- Login ตรวจ username/password ฝั่ง client
- Session ยังไม่ restore หลัง reload
- ทุก screen อยู่ URL เดียว
- Queue และ workflow data เป็น mock
- Action ส่วนใหญ่ยังไม่บันทึกข้อมูลจริง
- ไม่มี permission/role enforcement
- ไม่มี audit trail
- ไม่มี automated test suite
- Modal accessibility ยังไม่มี focus trap และ Escape handling ครบทุกจุด

ห้ามอธิบายว่าส่วนเหล่านี้พร้อม production จนกว่าจะพัฒนาและทดสอบจริง

## 8. ลำดับงานแนะนำ

### Phase 1 — Stabilize Prototype

- แก้ session restore
- เพิ่ม Error/Empty states มาตรฐาน
- เพิ่ม modal accessibility
- เพิ่ม unit/component tests สำหรับ workflow สำคัญ

### Phase 2 — Routing และ Backend Integration

- แยก URL route หรือ search parameters ตาม screen
- สร้าง HTTP client และ error contract กลาง
- เปลี่ยน mock API เป็น backend API ทีละ feature
- เพิ่ม mutations และ query invalidation

### Phase 3 — Production Readiness

- Authentication และ authorization จริง
- Audit trail
- Observability และ structured logging
- Security review
- Responsive/E2E regression tests
- Performance และ accessibility audit

## 9. Template สำหรับสั่งงานรอบถัดไป

คัดลอกข้อความด้านล่าง แล้วกรอกรายละเอียดงาน:

```md
# Development Task

## เป้าหมาย
[อธิบายผลลัพธ์ที่ต้องการ]

## Feature ที่เกี่ยวข้อง
[เช่น Verify / Matching / Checking / Dispensing / Dashboard / ME]

## พฤติกรรมปัจจุบัน
[ระบบทำงานอย่างไรในตอนนี้]

## พฤติกรรมที่ต้องการ
[ระบุ flow ใหม่แบบเป็นขั้นตอน]

## ข้อมูล/API
[ระบุ endpoint, request, response หรือให้ใช้ mock data]

## UI Requirements
- รักษา Theme เดิมตาม CONTINUE_DEVELOPMENT.md
- รองรับ Mobile และ Desktop
- ระบุ loading, empty, error และ disabled states

## Acceptance Criteria
- [ ] เงื่อนไขที่ 1
- [ ] เงื่อนไขที่ 2
- [ ] เงื่อนไขที่ 3
- [ ] Mobile ใช้งานได้
- [ ] Desktop ใช้งานได้
- [ ] `npm run lint` ผ่าน
- [ ] `npm run build` ผ่าน

## ข้อห้าม
- ห้ามเปลี่ยน Theme เดิม
- ห้ามแก้ feature อื่นที่ไม่เกี่ยวข้อง
- ห้ามลบ mock flow เดิมจนกว่า replacement จะทำงานครบ
```

## 10. Definition of Done

งานหนึ่งรายการถือว่าเสร็จเมื่อ:

- Behavior ตรงตาม Acceptance Criteria
- ไม่มี TypeScript หรือ ESLint error
- Production build ผ่าน
- Mobile และ Desktop ไม่เกิด overflow ที่ไม่ตั้งใจ
- Loading, Empty, Error และ Disabled states ครบตามความเหมาะสม
- Keyboard focus และ touch target ใช้งานได้
- ไม่เปลี่ยน Theme/UI เดิมนอกขอบเขต
- ไม่มีการทำลาย flow เดิมของ feature อื่น
- เอกสารหรือ type/API contract ถูกอัปเดตเมื่อ behavior เปลี่ยน
- สรุปไฟล์ที่แก้และข้อจำกัดที่ยังเหลือ

## 11. Prompt พร้อมใช้สำหรับ AI Agent

```text
โปรดพัฒนางานต่อในโปรเจกต์ JurapornWeb

ก่อนเริ่มงาน:
1. อ่าน ARCHITECTURE_REVIEW.md และ CONTINUE_DEVELOPMENT.md ให้ครบ
2. ตรวจ git status และรักษาการแก้ไขเดิมทั้งหมด
3. อ่านเฉพาะ source files ที่เกี่ยวข้องกับงาน

ข้อกำหนดบังคับ:
- ห้ามเปลี่ยน Theme/UI เดิม
- รักษา palette, typography, spacing, card style และ semantic colors เดิม
- รองรับ Mobile และ Desktop
- ใช้ architecture, shared components, types และ TanStack Query ตามรูปแบบเดิม
- ห้ามแก้ไฟล์นอกขอบเขตโดยไม่มีเหตุผล
- หลังแก้ไขให้รัน npm run lint และ npm run build
- สรุปสิ่งที่แก้ ไฟล์ที่ได้รับผลกระทบ ผลการทดสอบ และข้อจำกัดที่เหลือ

งานที่ต้องทำ:
[วางรายละเอียดงานใหม่ตรงนี้]
```

## 12. เอกสารอ้างอิง

- `ARCHITECTURE_REVIEW.md` — Architecture, file classification, Theme analysis และ technical debt
- `CONTINUE_DEVELOPMENT.md` — กฎและ workflow สำหรับพัฒนาต่อ
- `package.json` — Scripts และ dependencies ปัจจุบัน
- `src/types/pharmacy.ts` — Domain contracts หลัก

