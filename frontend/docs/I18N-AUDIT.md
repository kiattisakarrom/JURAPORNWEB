# รายงานสำรวจและ implementation TH/EN

วันที่ตรวจ: 5 ตุลาคม 2026

## ขอบเขตที่สำรวจก่อนแก้ไข

อ่าน route, layout/provider, feature component, shared UI, helper/API adapter และแหล่ง mock data ของ Frontend ก่อนเริ่มแก้ไข พบ **8 ไฟล์ page.tsx**, **26 ไฟล์ feature .tsx** และ **3 shared UI primitives** (`button`, `input`, `badge`)

| Route | ผลดำเนินการ |
| --- | --- |
| `/` | Redirect ไป Verify เดิม ไม่มี static UI ให้แปล |
| `/verify` | Queue ทุก tab, PatientPanel, Picking/Matching/Checking/Dispensing popup, Subjective, HAD, NOTE และ modal ME ภายใน Verify |
| `/matching` | ค้นหา guide/ยา, ตาราง, ปุ่ม, validation, NOTE และ notification |
| `/checking` | ค้นหา guide, barcode/QR, ตาราง, validation, NOTE และ notification |
| `/dispensing` | Station/assist/history, detail, modal ปลดช่อง, ปุ่มและ notification |
| `/drugmaster` | Allergy form/history/confirmation, dangerous pairs placeholder, label designer และ validation |
| `/dashboard` | **Excluded — ไม่แก้ไฟล์หน้า/feature/text/layout/logic** |
| `/me-report` | **Excluded — ไม่แก้ไฟล์หน้า/feature/text/layout/logic** |

Auth login/register อยู่ใน `WorkspaceApp` ไม่ใช่ route แยก และรองรับ TH/EN แล้ว

### Component สำคัญและจุดที่พบ hard-coded text

- `AuthScreen`: heading, tabs, label/placeholder, password visibility, login/register toast
- `WorkspaceApp`, `SidebarNav`, `WorkspaceHeader`, `PharmacyDashboard`: loading, menu, date/search labels, queue tabs, connection/error/empty state, pagination, workflow notifications
- `QueueTable`, `MobileQueueList`, `ClinicalAlertBadges`: header, buttons, counts, clinical alert tooltip labels และ fallback UI
- `PatientPanel`, `MachineStockCheck`: patient heading labels, empty-data fallback, NOTE/save state, stock labels, HAD checklist, Verify button และ local ME modal
- `MatchingCheckingScreen`, `MatchingPopup`, `CheckingCheckoutPopup`: guide/medicine/basket fields, table labels, validation/error, modal title, photo placeholder, controls
- `DispensingQueueScreen`, `DispensingPopup`: station selector, detail, history, confirmation/release form, errors และ actions
- `DrugMasterScreen`, `DrugAllergyManager`, `DrugLabelCanvas`: allergy search/form/table/confirmation, label tools/settings/file picker, save/publish errors
- `PickingPrescriptionPopup`, `PatientProfilePopup`, `PackageNoteModal`: title, table header, labels, buttons, loading และ save feedback
- `VerifyStatusCheckbox` และ shared primitives รับข้อความจาก caller ไม่มี static text ที่ต้องเปลี่ยนในตัวเอง

### Static UI และ Dynamic Data

Static UI ใช้ key สำหรับ heading/menu/label/button/placeholder/table header/modal/tooltip/frontend validation/success/error โดยใช้ `common.*` สำหรับข้อความที่ใช้ร่วมกัน เช่น cancel, close, quantity, medication, notes และ saved

Dynamic Data แสดงค่าเดิม: patient/drug/doctor/ward name, HN/VN/PN/AN, guide/basket/drug code/barcode/QR, dose instruction, quantity/unit/date/time, status/priority จาก API, note ที่ผู้ใช้กรอก, clinical severity/reaction/effect/management และข้อความผิดพลาดจาก server ข้อมูลเหล่านี้ไม่ผ่าน `t(dynamicValue)`

คงข้อความในข้อมูล mock/service return ที่ทำหน้าที่เป็นข้อมูลรายการหรือ clinical note เช่น Subjective, directions, status presenters และชื่อยาไว้ด้วย ไม่แก้ adapter/API contract หรือ backend

### Shared dependencies ของ Excluded Pages

`WorkspaceApp → PharmacyDashboard → SidebarNav + WorkspaceHeader` เป็น shell ร่วมทั้งเจ็ดหน้าทำงาน `PharmacyDashboard` เป็นชื่อ shared shell ไม่ใช่ feature ของหน้า Dashboard (`OperationsDashboard`)

`OperationsDashboard` และ `MedicationErrorScreen` ใช้ QueryClient, Button/Badge/Input และ `workstation-api` ร่วมกัน สิ่งเหล่านี้ยังใช้ instance, props/workflow และ styling เดิม Generic UI primitives, `queue-ui.tsx` และ `workstation-api.ts` ไม่ได้แก้ไข

`MedicationErrorReportModal.tsx` ยังถูกเรียกจาก Matching/Checking จึงคงทั้งไฟล์ไว้ตามข้อห้าม แม้ modal นั้นจะแสดงบนหน้าที่อยู่ใน scope ส่วน local modal ของ Verify อยู่ใน `PatientPanel.tsx` จึงแปลเฉพาะตรงนั้น และใช้สำเนา catalog ตาม ID โดยไม่เปลี่ยน catalog ต้นฉบับ

พบ hard-coded ใน Excluded Pages และ **รายงานอย่างเดียว**:

- `OperationsDashboard`: “กำลังโหลด dashboard...”, “ปริมาณงานแต่ละขั้นตอน”, “เวลารอรับยาเฉลี่ย”, “ภาระงานเครื่องจัดยา”, “แจ้งเตือนระบบ”; ข้อมูล dashboard mock ใน `workstation-api` มี “ใบสั่งยาวันนี้”, “ค้างในระบบ” ฯลฯ
- `MedicationErrorScreen`: “รายงานความคลาดเคลื่อนทางยา”, “รายงาน ME ใหม่”, “ทั้งหมด”, “เป็น ME”, “ไม่เป็น ME”, “การกระจายตามระดับความรุนแรง”, “ผู้รายงาน”
- `MedicationErrorReportModal`: ประเภท/ชนิด ME, severity A–I, label/placeholder, validation และปุ่มเดิมทั้งหมด

## Architecture ที่เลือก

ใช้ React Context + typed translation function + JSON resources โดยไม่เพิ่ม runtime library เพราะเป็น client workspace แบบ flat routes มี React Context อยู่แล้วและต้องรักษา router, form state, QueryClient และ realtime cache เดิม ไม่ต้องทำ locale-prefixed URL หรือ remount ทั้งหน้า

- `th.json` / `en.json`: ข้อความ UI สองภาษา
- `legacy.json`: ข้อความต้นฉบับ สำหรับ shared shell เมื่อ route เป็น `/dashboard` หรือ `/me-report` เท่านั้น
- `I18nProvider`: เก็บ preference ที่ `localStorage["pharmauto-language"]`, จำเมื่อเปลี่ยนหน้า/refresh, sync ระหว่างแท็บ, ปรับ `html.lang`, ไม่ reload/remount children
- `LanguageSwitcher`: **TH | EN** บน Auth/shell และ popup ที่เกี่ยวข้อง ซ่อนบน Excluded Pages
- `uiMessage` + `<Message>`: เก็บ descriptor ของ frontend validation/error ใน presentation state ทำให้ข้อความที่แสดงอยู่เปลี่ยนภาษาทันที
- `uiToast`: notification ที่ mount อยู่เปลี่ยนภาษาตาม Context
- `frontendErrorMessage`: แปลเฉพาะ Error ที่มี metadata `uiMessage` ระบุชัดเจน ข้อความจาก server ยังเป็น raw string เดิม รวมถึง `.message`, `.status` และ `.details` ของ error
- `LocalizedFileInput`: แปล Choose file/No file chosen โดยคงไฟล์และชื่อไฟล์ที่เลือกไว้

Shared shell บน Excluded Pages ใช้ข้อความจาก legacy, ไม่มี switcher และไม่มีการเพิ่ม flex-wrap ของ header สำหรับสองหน้านั้น พฤติกรรม navigation/filter/logout/query และ feature ของสองหน้าไม่เปลี่ยน

## Translation keys

มี **633 keys** ในแต่ละ resource โดย key และ interpolation parameters ตรงกันทั้งสามไฟล์ ดูรายการเต็มที่ `src/i18n/locales/th.json` และ `en.json`

| Namespace | จำนวน |
| --- | ---: |
| `auth` | 26 |
| `checking` | 20 |
| `dispensing` | 100 |
| `common` | 70 |
| `drug-master` | 107 |
| `matching` | 22 |
| `patient-profile` | 6 |
| `picking` | 3 |
| `queue` | 78 |
| `shell` | 9 |
| `verify` | 116 |
| `workflow` | 76 |

ตัวอย่าง: `common.cancel`, `shell.searchVnHnOrPatientName`, `workflow.enterAGuideCode`, `verify.meSeverity.B`, `drug-master.confirmDrugAllergyRecord`

## ตรวจข้อความที่เหลือหลัง implementation

สำรวจ JSX text, UI attributes, Thai/English literals, local label catalogs, template literals, error/toast และ data helpers ซ้ำแล้ว ข้อความที่จงใจคงไว้มี:

| ตำแหน่ง/ประเภท | เหตุผล |
| --- | --- |
| Excluded feature/route/catalog | ข้อห้ามของผู้ใช้ |
| Status presenters ใน MatchingPopup, DispensingPopup/QueueScreen, PatientPanel และ `queue-ui` | คงการแสดงสถานะ/priority ที่มาจาก API ตามเดิม |
| Drug label canvas/template text, hospital name, phone, sample data, default “ข้อความใหม่” | เป็นเนื้อหาฉลาก/ข้อมูลที่แก้ไขและบันทึกได้ ไม่ใช่เครื่องมือ UI; ไม่แปลหรือเปลี่ยนเมื่อสลับภาษา |
| Allergy datalist values เช่น Drug Allergy/Mild/Certain | เป็นค่าที่ผู้ใช้เลือกเก็บใน payload ไม่เปลี่ยนค่า canonical หรือ free text |
| ชื่อผู้ป่วยว่างใน state query | state เก็บเดิม แต่ fallback ที่แสดงแปลที่ render เท่านั้น |
| “ส่ง Pending จากคิว Verify”, “Pharmacist” | API request payload เดิม ไม่แปล |
| ข้อความต้นฉบับใน Error + metadata | รักษา contract `.message`; ข้อความ UI แสดงผ่าน descriptor |
| ownerName sentinel “รอรับแพ็กเกจยารอบปัจจุบัน” | ค่าเดิมภายใน presentation state; หน้าจอใช้ blockedReason/localized read-only notice |
| DI/AI, HN/VN/PN/QR/BMI, เครื่องหมายและตัวเลข | identifier/medical acronym/data เดิม |

ไม่พบ static text ที่ต้องแปลนอกกลุ่มข้อยกเว้น/ข้อมูลข้างต้นจากการสำรวจซ้ำ

## ไฟล์ที่เพิ่ม

- `src/i18n/index.tsx`
- `src/i18n/messages.ts`
- `src/i18n/toast.tsx`
- `src/i18n/LanguageSwitcher.tsx`
- `src/i18n/LocalizedFileInput.tsx`
- `src/i18n/locales/th.json`
- `src/i18n/locales/en.json`
- `src/i18n/locales/legacy.json`
- `src/features/verify/medication-error-ui.ts`
- `tests/i18n.test.mjs`
- `tests/i18n-browser.mjs`
- `docs/I18N-AUDIT.md`

## ไฟล์ที่แก้

- `package.json`
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/features/auth/AuthScreen.tsx`
- `src/features/checking/CheckingCheckoutPopup.tsx`
- `src/features/dispensing/DispensingPopup.tsx`
- `src/features/dispensing/DispensingQueueScreen.tsx`
- `src/features/drug-master/DrugAllergyManager.tsx`
- `src/features/drug-master/DrugLabelCanvas.tsx`
- `src/features/drug-master/DrugMasterScreen.tsx`
- `src/features/matching/MatchingPopup.tsx`
- `src/features/patient-profile/PatientProfilePopup.tsx`
- `src/features/picking/PickingPrescriptionPopup.tsx`
- `src/features/queue/ClinicalAlertBadges.tsx`
- `src/features/queue/MobileQueueList.tsx`
- `src/features/queue/PharmacyDashboard.tsx`
- `src/features/queue/QueueTable.tsx`
- `src/features/shell/SidebarNav.tsx`
- `src/features/shell/WorkspaceApp.tsx`
- `src/features/shell/WorkspaceHeader.tsx`
- `src/features/shell/shell-types.ts`
- `src/features/verify/MachineStockCheck.tsx`
- `src/features/verify/PatientPanel.tsx`
- `src/features/workflow/MatchingCheckingScreen.tsx`
- `src/features/workflow/PackageNoteModal.tsx`
- `src/lib/api-client.ts`
- `src/lib/client-uuid.ts`
- `src/lib/drug-label-print.ts`
- `src/lib/verify-prescriptions-api.ts`

API utility ฝั่ง Frontend ที่แก้เพิ่มเฉพาะ presentation metadata ให้ frontend-generated errors ไม่เปลี่ยน URL, query, request/response fields, retry, barcode, matching/checking rules หรือฐานข้อมูล

ไม่มีการแก้ Backend/Database, route/feature ของ Dashboard/MEreport, `.env`, secrets หรือข้อมูลผู้ป่วยจริง และไม่ได้ commit

## ผลทดสอบ

- `npm run lint`: ผ่าน
- `npm run build`: ผ่าน production compilation/TypeScript/static routes
- `npm run test:i18n`: **8 tests ผ่าน** — resource parity/interpolation, live validation, nested message, raw data, preference/storage failure, excluded text, key references, frontend/server error separation และ error contract
- `npm run test:realtime`: **20 tests ผ่าน** — regression ของ navigation/cache/realtime/UUID
- Chrome + Playwright บน production server โดย intercept Backend API ทั้งหมดเป็นข้อมูลจำลอง ไม่มีการต่อ Backend/SQL Server: TH → EN → TH, username/password/Verify NOTE/barcode/allergy fields ไม่หาย, route และ refresh จำภาษา, validation ที่เปิดอยู่เปลี่ยนภาษา, notification/modal/HAD/Subjective/local Verify ME/NOTE/allergy เปลี่ยนข้อความ, patient/drug/status/clinical note/template text และ note payload คงเดิม
- ตรวจ mobile 390×844 ทั้งห้าหน้าใน scope และ desktop 1440×1000 ไม่มี horizontal overflow ของ document (ตาราง/เมนูที่ออกแบบให้ scroll ภายในยังคง scroll เดิม)
- เปิด Dashboard/MEreport ขณะ preference เป็น EN: หน้าและ shared text คงภาษาเดิม, ไม่แสดง switcher, preference EN ยังคงบันทึกไว้ และกลับ Verify แล้วเป็น EN
- ตรวจ diff: ไม่มีการเปลี่ยนไฟล์ Excluded Pages/ME-specific components/Backend

## วิธีเพิ่มข้อความในอนาคต

1. เลือก `common.*` ที่มีอยู่ก่อน หากเป็นข้อความซ้ำ; ข้อความเฉพาะใช้ namespace ของ feature
2. เพิ่ม key เดียวกันใน `th.json` และ `en.json` พร้อม parameters ชื่อเดียวกัน เพิ่ม original text ใน `legacy.json` โดยเฉพาะ key ของ shared shell เพื่อรักษา Excluded Pages
3. ใช้ `useTranslation()` และ `t("key")` ใน render; ค่า API แสดงตรง ๆ หรือเป็น parameter ของประโยค UI เช่น `t("common.severityWithCode", { code: value })` ไม่ใช้ `t(value)`
4. ข้อความ frontend validation/error ที่เก็บ state ใช้ `uiMessage("key")` และ `<Message value={error} />`; toast ใช้ `uiToast.error(uiMessage("key"))`; API error ใช้ raw message
5. ห้ามใส่ descriptor/key ใน API payload, patient/drug/status/template text หรือ form value และห้ามเพิ่ม locale ใน query/cache key
6. ไม่แก้ไฟล์ Dashboard/MEreport/ME-specific modal จนได้รับคำสั่ง; การเพิ่ม shared key ต้องตรวจ legacy route ด้วย
7. รัน lint/build/test:i18n และ regression ที่เกี่ยวข้อง

Browser test ใช้ Playwright จาก runtime ที่มีอยู่ ไม่เพิ่ม dependency ให้ application สามารถใช้ `PLAYWRIGHT_MODULE` ชี้ไปยัง package ที่ติดตั้งไว้, `CHROME_EXECUTABLE` ชี้ Chrome, `I18N_TEST_URL` ชี้ local production server และ `I18N_SCREENSHOT_DIR` เลือกโฟลเดอร์ภาพ:

```sh
npm run build
npm start -- -H 127.0.0.1 -p 3002
# อีก terminal ที่มี Playwright พร้อมใช้งาน
I18N_TEST_URL=http://127.0.0.1:3002 npm run test:i18n:browser
```

## ข้อจำกัดและจุดที่ควรตรวจเพิ่ม

- `MedicationErrorReportModal` ที่ Matching/Checking เรียกยังมีข้อความเดิม เนื่องจากเป็น component ในกลุ่ม ME ที่ห้ามแก้ งานส่วนนี้ต้องรอคำสั่งอนุญาตเพิ่มเติม
- พบปัญหาเดิมในปุ่มยืนยัน guide ของ Checking: `onClick={onFindGuide}` ส่ง click event เข้า `findGuide(codeValue)` แล้วเรียก `.trim()` จึงเกิด TypeError; เทียบต้นฉบับแล้วมีอยู่ก่อนงานนี้ ไม่แก้ business workflow การกด Enter ในช่อง guide ยังทำงานและใช้ทดสอบ validation
- ยังไม่ได้ทดสอบกับ API/ฐานข้อมูลจริง เครื่องสแกน หรือเครื่องพิมพ์จริง; ควรทำ acceptance test บนสภาพแวดล้อมที่อนุญาตก่อนใช้งานจริง
- localStorage ถูกปิดจะยังสลับภาษาในแท็บได้ แต่จำหลัง refresh ไม่ได้ตามข้อจำกัด browser; preference ปกติผ่านการทดสอบแล้ว


## ปรับตามคำขอ 6 ตุลาคม 2026

- จอ desktop กว้างตั้งแต่ 1800px: header ใช้แถวเดียว, ย้ายพื้นที่ยืดจากก่อนตัวเลือกวันที่ไปที่ช่องค้นหา, ลด gap เพื่อให้วันที่ เวลา ค้นหา TH/EN และออกอยู่แถวเดียวที่ 1920×1080 ทั้งสองภาษา
- Toast ของหน้าที่อยู่ใน scope อยู่ใต้ header บนจอกว้าง เพื่อไม่บังตัวสลับภาษา/ออก; Dashboard และ MEreport ยังคงตำแหน่ง toast/header เดิม
- แปล menu/tab/stage label ใน Verify ตามคำที่ระบุ: ตรวจ, หยิบยา, จับคู่, ตรวจสอบ, จ่ายยา, รอดำเนินการ, สำเร็จ, เรียกไม่พบ รวมถึงหัวคอลัมน์ “ความเร่งด่วน”, “ระยะเวลา”, คอลัมน์ “ตรวจ” ของตาราง PN และข้อความปุ่ม/คำแนะนำที่อ้างชื่อขั้นตอนเหล่านี้ ที่ขยายออกมา โดยชื่อขั้นตอนเป็น UI label จาก enum ที่รู้จัก ค่า stage/status ใน state/API และ payload ไม่เปลี่ยน
- `queue-ui.tsx` เปลี่ยนเฉพาะ formatter ของ label ให้รับ translator ตามคำสั่งล่าสุด (รายการเดิมที่ระบุว่า formatter นี้ยังไม่แปลเป็นผลตรวจของวันที่ 5 ตุลาคม)
- ใช้ **Chulabhorn Likit Text** จากโฟลเดอร์ที่ผู้ใช้ให้มา ผ่าน WOFF2 weight 300/400/500/700 ใน `public/fonts/` กับ body, font-sans, font-mono, controls, notifications, label preview และ print HTML; ไม่แก้ข้อความ/template data จาก API
- คำสั่งเปลี่ยนฟอนต์ทุกหน้าครอบคลุม Dashboard/MEreport ด้วย โดยใช้ global typography; ไฟล์เฉพาะของสองหน้ามีเนื้อหาเหมือน HEAD ทุก byte และ legacy resources ไม่เปลี่ยน
- ไฟล์ที่แก้เพิ่มเติมในรอบนี้: `src/app/globals.css`, `src/app/providers.tsx`, `src/features/shell/WorkspaceHeader.tsx`, `src/features/queue/queue-ui.tsx`, `QueueTable.tsx`, `MobileQueueList.tsx`, `PatientPanel.tsx`, `PickingPrescriptionPopup.tsx`, `DrugLabelCanvas.tsx`, `DrugMasterScreen.tsx`, `src/lib/drug-label-print.ts`, `src/i18n/locales/th.json` และ tests ที่เกี่ยวข้อง
- เพิ่ม font assets: `chulabhornlikittext-light.woff2`, `chulabhornlikittext-regular.woff2`, `chulabhornlikittext-medium.woff2`, `chulabhornlikittext-bold.woff2` โดยเทียบแล้วเหมือนต้นฉบับที่ให้มา
- ผลตรวจ: lint/build ผ่าน, i18n 9 tests ผ่าน, realtime/print 20 tests ผ่าน; browser ตรวจ 1920×1080 TH/EN ว่า header เป็นแถวเดียวและไม่มี clipping, คำไทยครบ 8 ขั้นตอน/คอลัมน์ PN, font loading ครบ 4 weights, toast ไม่บัง header และ regression ฟอร์ม/popup/refresh/mobile/excluded pages
