// Synthetic API fixtures only. No backend or database requests leave the browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const loadPackage = createRequire(import.meta.url);
const { chromium } = loadPackage(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.I18N_TEST_URL || 'http://localhost:3000';
const screenshots = process.env.I18N_SCREENSHOT_DIR || path.join(os.tmpdir(), 'juraporn-i18n-qa');
const date = '2026-10-06';
const patientName = 'Patient i18n / ผู้ป่วยทดสอบ', drugName = 'Calcium Carbonate', note = 'API note / ข้อความจาก API';
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const packages = ['MATCHING', 'CHECKING', 'PICKING'].map((stage, index) => ({
  PACKAGE_ID: ids[index], WORKFLOW_ID: 'work-'+index, PACKAGE_NUMBER: 'GUIDE-'+(index+1), BATCH_NO: 1,
  PACKAGE_PRIORITY: 'NORMAL', PAGE_NOW: stage, PACKAGE_STATUS: stage, IS_ACTIVE: true, VERIFY_NOTE: note,
  DISPENSING_PICKUP_STATUS: null, CALL_COUNT: 0, LAST_CALLED_AT: null, RECEIVED_AT: null,
  CREATED_AT: date, UPDATED_AT: date, ROW_VERSION: '1', VISITDATETIME: date, VISITNUMBER: 'VN-'+index,
  PATIENTID: 'HN-01', PATIENT_NAME: patientName, PAYMENT_STATUS: 'READY', ALLOWED_ACTIONS: [],
  ITEMS: [{ PACKAGE_ITEM_ID: 'item-'+index, PRESCRIPTIONNUMBER: 'PN-01', ITEMSEQ: 1, MEDICINECODE: 'DRUG-01',
    COMMERCIALNAME: drugName, ORDERQTY: 30, ORDERUNITCODE: 'TAB', DOSEMEMO_TH: 'API directions / วิธีใช้จาก API',
    SOURCE_URGENCY_CODE: null, PICKING_STATUS: 'WAITING', MATCHING_STATUS: 'WAITING', CHECKING_STATUS: 'WAITING',
    MATCHED_AT: null, CHECKED_AT: null, LABEL: { LABEL_PUBLIC_ID: 'label-01', QR_TOKEN: 'QR-01', LABEL_STATUS: 'WAITING', PRINT_COUNT: 0, PRINTED_AT: null } }],
}));
const patient = { PATIENTID: 'HN-00', FULLNAME_TH: patientName, PRESCRIPTIONS: [{ SOURCE_REVISION: '1', CREATEDATETIME: date,
  VISITDATETIME: date, VISITNUMBER: 'VN-00', PRESCRIPTIONNUMBER: 'PN-00', CLINIC_CODE: 'OPD', LOCALWARDNAME: 'API Ward',
  DOCTOR: { DOCTORCODE: 'DOC-01', LOCALDOCTORNAME: 'API Doctor' }, ITEMS: [{ ITEMSEQ: 1, CREATEDATETIME: date,
    MEDICINECODE: 'DRUG-01', COMMERCIALNAME: drugName, ORDERQTY: 30, ORDERUNITCODE: 'TAB', DOSEMEMO_TH: 'API directions / วิธีใช้จาก API' }] }] };
// Two PNs exercise the expanded Verify table and its action/check column.
patient.PRESCRIPTIONS.push({ ...patient.PRESCRIPTIONS[0], PRESCRIPTIONNUMBER: 'PN-00B' });
const snapshot = { DATASET_ID: 'i18n-test', CURSOR: 'cursor-1', LOCKS: [], REMOVED_KEYS: [], HAS_MORE: false,
  UPSERTS: [{ VISITDATETIME: date, VISITNUMBER: 'VN-00', REVISION: '1', PATIENTS: [patient], WORKFLOWS: [], PACKAGES: [] },
    ...packages.map(p => ({ VISITDATETIME: date, VISITNUMBER: p.VISITNUMBER, REVISION: '1', PATIENTS: [], WORKFLOWS: [], PACKAGES: [p] }))] };
const workflow = { WORKFLOW_ID: 'verify-work-01', WORKFLOW_PUBLIC_ID: 'verify-public-01', VISITDATETIME: date,
  VISITNUMBER: 'VN-00', PATIENTID: 'HN-00', PATIENT_NAME: patientName, WORKFLOW_RUN_NO: 1,
  CASE_STATUS: 'VERIFY', IS_ACTIVE: true, QUEUE_NO: 1, BLOCK_REASON_CODE: null, BLOCK_REASON_TEXT: null,
  PAYMENT_STATUS: 'READY', VERIFY_NOTE_DRAFT: note, VERIFY_NOTE_UPDATED_AT: date, VERIFY_NOTE_UPDATED_BY: 'API User',
  CREATED_AT: date, UPDATED_AT: date, ROW_VERSION: '1', ACTIVE_PACKAGE_ID: null,
  VERIFY_LOCK: { LOCK_TOKEN: 'test-lock', SESSION_ID: null, OWNER_NAME: 'API Owner', WORKSTATION_CODE: 'VERIFY-WEB',
    LOCKED_AT: date, EXPIRES_AT: '2099-01-01T00:00:00Z', IS_LOCKED: true },
  PRESCRIPTIONS: [{ PACKAGE_PRESCRIPTION_ID: 'vp-01', PRESCRIPTIONNUMBER: 'PN-00', VERIFY_STATUS: 'WAITING',
    VERIFIED_AT: null, SOURCE_HASH: null, ITEM_STATES: [] }] };
const dispense = { PACKAGE_ID: 'dispense-01', WORKFLOW_ID: 'd-01', PACKAGE_NUMBER: 'GUIDE-D', PAGE_NOW: 'DISPENSING',
  DISPENSING_PICKUP_STATUS: 'WAITING_CALL', DISPENSING_CHANNEL: 1, QUEUE_READY_AT: date, CHECKING_COMPLETED_AT: date,
  LAST_CALLED_AT: null, RECEIVED_AT: null, CALL_COUNT: 0, ROW_VERSION: '1', VISITDATETIME: date, VISITNUMBER: 'VN-D',
  PATIENTID: 'HN-01', PATIENT_NAME: patientName, VERIFY_NOTE: note, ITEM_COUNT: 1 };
const template = { TEMPLATE_ID: 't-01', VERSION_NO: 1, ROW_VERSION: '1', WIDTH_MM: 100, HEIGHT_MM: 60,
  LOGO_DATA_URL: '/assets/juraporn-hospital-emblem.png', DEFINITION: { elements: [{ id: 'test-text', type: 'text',
    text: 'API template text / ข้อความฉลาก', xMm: 10, yMm: 30, widthMm: 70, heightMm: 10, zIndex: 1, fontSizePt: 10 }] } };

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [], requests = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser error:', e.message); });
    await page.addInitScript(() => { window.EventSource = class { addEventListener() {} close() {} }; });
    await page.route('**/backend-api/**', async route => {
      const request = route.request(), endpoint = new URL(request.url()).pathname.replace('/backend-api/api/v1', '');
      const body = request.postDataJSON(); requests.push({ endpoint, body, method: request.method() });
      let result;
      if (endpoint.startsWith('/realtime/')) result = snapshot;
      else if (endpoint === '/package-workflows/verify-lock') {
        workflow.VERIFY_LOCK.SESSION_ID = body.sessionId;
        snapshot.UPSERTS[0].WORKFLOWS = [workflow]; snapshot.UPSERTS[0].REVISION = '2'; result = workflow;
      }
      else if (endpoint.startsWith('/package-workflows/')) {
        if (endpoint.endsWith('/verify-note')) { workflow.VERIFY_NOTE_DRAFT = body.note; result = { WORKFLOW_ID: workflow.WORKFLOW_ID, VERIFY_NOTE_DRAFT: body.note, VERIFY_NOTE_UPDATED_AT: date }; }
        else { if (request.method() === 'DELETE') { workflow.VERIFY_LOCK = { ...workflow.VERIFY_LOCK, LOCK_TOKEN: null, IS_LOCKED: false }; snapshot.UPSERTS[0].REVISION = '3'; } result = workflow; }
      }
      else if (endpoint.startsWith('/dispensing/queue')) result = { CURSOR: 'd-1', UPSERTS: [dispense], REMOVED_IDS: [], CHANNELS: Array.from({ length: 8 }, (_, i) => ({ CHANNEL_NO: i+1, OCCUPIED: i === 1 })) };
      else if (endpoint.includes('/dispensing/channels/')) result = { CHANNEL_NO: 1, CLAIMED: true };
      else if (endpoint === '/dispensing/history') result = { PAGE: 1, ITEMS: [{ ...dispense, PAGE_NOW: 'COMPLETE' }], HAS_MORE: false };
      else if (endpoint === '/drug-allergies/search-patients') result = [{ PATIENTID: 'HN-01', FULLNAME_TH: patientName }];
      else if (endpoint === '/drug-allergies/search-medicines') result = [{ MEDICINECODE: 'DRUG-01', COMMERCIALNAME: drugName, GENERICNAME: drugName, LOCALNAME: null, STRENGTH: '600mg' }];
      else if (endpoint === '/drug-allergies/history') result = { PATIENT: { PATIENTID: 'HN-01', FULLNAME_TH: patientName }, ITEMS: [] };
      else if (endpoint === '/drug-label-templates/current') result = { DRAFT: template, ACTIVE: template };
      else if (/\/packages\/[^/]+\/note$/.test(endpoint)) result = { PACKAGE_ID: endpoint.split('/')[2], VERIFY_NOTE: body.note, UPDATED_AT: date };
      else if (endpoint.startsWith('/packages/')) result = packages.find(p => endpoint.includes(p.PACKAGE_ID)) || { ...packages[0], PACKAGE_ID: 'dispense-01' };
      else { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'API error / ข้อความจากระบบ' }) }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    });
    const switchTo = async lang => { await page.getByRole('button', { name: lang === 'en' ? /เลือกภาษาอังกฤษ|Select English/ : /เลือกภาษาไทย|Select Thai/ }).last().click(); await page.waitForFunction(lang => document.documentElement.lang === lang, lang); };
    const has = async value => page.waitForFunction(value => document.body.innerText.includes(value), value);
    const navNames = { Verify: /^(Verify|ตรวจ)$/, Matching: /^(Matching|จับคู่)$/, Checking: /^(Checking|ตรวจสอบ)$/, Dispensing: /^(Dispensing|จ่ายยา)$/, 'ข้อมูลยา': /^(Drug master|ข้อมูลยา)$/ };
    const nav = async label => page.locator('aside nav').getByRole('button', { name: navNames[label] || label, exact: true }).click();
    const shot = async name => page.screenshot({ path: path.join(screenshots, name+'.png') });
    const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal page overflow');
    const siteFont = async () => {
      const result = await page.evaluate(async () => {
        const faces = await Promise.all([300, 400, 500, 700].map(weight => document.fonts.load(`${weight} 16px "Chulabhorn Likit Text"`)));
        return { faces: faces.map(items => items.length), family: getComputedStyle(document.body).fontFamily,
          toast: document.querySelector('[data-sonner-toaster]') ? getComputedStyle(document.querySelector('[data-sonner-toaster]')).fontFamily : null,
          mono: document.querySelector('.font-mono') ? getComputedStyle(document.querySelector('.font-mono')).fontFamily : null };
      });
      assert.ok(result.family.startsWith('"Chulabhorn Likit Text"'), JSON.stringify(result));
      if (result.toast) assert.ok(result.toast.startsWith('"Chulabhorn Likit Text"'), JSON.stringify(result));
      if (result.mono) assert.ok(result.mono.startsWith('"Chulabhorn Likit Text"'), JSON.stringify(result));
      assert.ok(result.faces.every(count => count === 1), JSON.stringify(result));
    };
    const desktopHeader = async () => {
      await siteFont();
      const layout = await page.locator('header').first().evaluate(header => {
        const rect = header.getBoundingClientRect();
        const children = [...header.firstElementChild.children].filter(el => el.getBoundingClientRect().width > 0);
        return { height: rect.height, children: children.map(el => { const r = el.getBoundingClientRect(); return { text: el.textContent, center: r.y + r.height / 2, left: r.left, right: r.right }; }),
          dateLeft: header.querySelector('[aria-label]').getBoundingClientRect().left, width: document.documentElement.clientWidth };
      });
      const centers = layout.children.map(item => item.center);
      assert.ok(Math.max(...centers) - Math.min(...centers) < 2, 'Header wrapped: '+JSON.stringify(layout));
      assert.ok(layout.children.every(item => item.left >= 0 && item.right <= layout.width), 'Header clipped: '+JSON.stringify(layout));
      assert.ok(layout.height <= 90, 'Header grew beyond one row: '+JSON.stringify(layout));
      assert.ok(layout.dateLeft < 960, 'Date selector did not move left');
      await page.locator('header').getByRole('button', { name: /^(Sign out|ออก)$/ }).waitFor();
    };
    const stageTabs = async lang => {
      const labels = lang === 'th' ? ['ตรวจ', 'หยิบยา', 'จับคู่', 'ตรวจสอบ', 'จ่ายยา', 'รอดำเนินการ', 'สำเร็จ', 'เรียกไม่พบ'] : ['Verify', 'Picking', 'Matching', 'Checking', 'Dispensing', 'Pending', 'Complete', 'Missed-call'];
      const tabs = page.locator('main nav').last();
      for (const label of labels) await tabs.getByRole('button', { name: new RegExp('^'+label+'\\s+\\d') }).waitFor();
    };
    await page.goto(baseUrl+'/verify');
    await page.getByPlaceholder('ชื่อผู้ใช้', { exact: true }).fill('unfinished username'); await siteFont();
    await page.getByPlaceholder('รหัสผ่าน', { exact: true }).fill('unfinished password');
    await switchTo('en');
    assert.equal(await page.getByPlaceholder('Username', { exact: true }).inputValue(), 'unfinished username');
    assert.equal(await page.getByPlaceholder('Password', { exact: true }).inputValue(), 'unfinished password');
    await shot('auth-en'); await switchTo('th');
    assert.equal(await page.getByPlaceholder('ชื่อผู้ใช้', { exact: true }).inputValue(), 'unfinished username');
    await switchTo('en');
    await page.getByPlaceholder('Username', { exact: true }).fill('1'); await page.getByPlaceholder('Password', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Open workstation', exact: true }).click();
    await page.getByPlaceholder('Search VN, HN or patient name').waitFor();
    await page.getByText(patientName, { exact: true }).first().waitFor();
    await page.reload(); await page.getByPlaceholder('Search VN, HN or patient name').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('pharmauto-language')), 'en'); await noOverflow(); await desktopHeader(); await stageTabs('en'); await shot('verify-en');
    await switchTo('th'); await desktopHeader(); await stageTabs('th'); await shot('verify-th'); await switchTo('en');
    await page.getByText(patientName, { exact: true }).first().click();
    const checkColumn = page.locator('[data-verify-scroll-container] div.grid:not([role]) > span:last-child');
    assert.equal(await checkColumn.textContent(), 'Check');
    await switchTo('th'); assert.equal(await checkColumn.textContent(), 'ตรวจ');
    await shot('verify-expanded-th'); await switchTo('en');
    await page.getByText('PN-00', { exact: true }).first().click(); await page.locator('#verify-note').waitFor();
    assert.equal(await page.locator('#verify-note').inputValue(), note);
    await page.locator('#verify-note').fill('Verify draft / ข้อความทดสอบ'); await switchTo('th');
    assert.equal(await page.locator('#verify-note').inputValue(), 'Verify draft / ข้อความทดสอบ'); await has(drugName);
    await switchTo('en'); await shot('verify-panel-en');
    await page.getByRole('button', { name: 'HAD checklist', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm strength / dosage form', exact: true }).click();
    await switchTo('th'); await has('ยืนยันความเข้มข้น / รูปแบบยา'); await switchTo('en'); await shot('had-en');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Open Subjective', exact: true }).click();
    await page.getByRole('textbox', { name: 'Read-only Subjective text', exact: true }).waitFor();
    const subjective = await page.getByRole('textbox', { name: 'Read-only Subjective text', exact: true }).innerText();
    await switchTo('th'); assert.equal(await page.getByRole('textbox', { name: 'ข้อความ Subjective แบบอ่านอย่างเดียว', exact: true }).innerText(), subjective);
    await switchTo('en'); await shot('subjective-en');
    await page.locator('aside').filter({ has: page.getByRole('heading', { name: 'Subjective', exact: true }) }).getByRole('button').last().click();
    await page.getByRole('button', { name: new RegExp(drugName) }).last().click();
    await page.getByRole('button', { name: 'Report ME', exact: true }).click();
    await page.getByRole('button', { name: 'Prescribing error', exact: true }).click();
    await page.getByRole('button', { name: 'Wrong drug prescribed', exact: true }).click();
    await page.getByRole('button', { name: /B No Harm Error did not reach the patient/ }).click();
    await page.locator('#medication-error-description').fill('Unsaved ME details / รายละเอียดทดสอบ');
    await switchTo('th'); assert.equal(await page.locator('#medication-error-description').inputValue(), 'Unsaved ME details / รายละเอียดทดสอบ');
    await has('ระดับความรุนแรง B'); await switchTo('en'); await has('Severity B'); await shot('verify-me-en');
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    await page.getByRole('button', { name: 'Close', exact: true }).last().click(); await page.locator('#verify-note').waitFor({ state: 'hidden' });
    assert.equal(requests.find(r => r.endpoint.endsWith('/verify-note')).body.note, 'Verify draft / ข้อความทดสอบ');
    await nav('Matching'); await page.locator('#matching-guide-code').waitFor(); await desktopHeader();
    await page.getByRole('button', { name: 'Confirm guide code', exact: true }).click(); await has('Enter a guide code');
    await switchTo('th'); await has('กรุณากรอกรหัสใบนำทาง'); await switchTo('en');
    await page.locator('#matching-guide-code').fill('GUIDE-1'); await page.getByText(drugName, { exact: true }).waitFor();
    await page.locator('#matching-medicine-code').fill('unfinished medicine code');
    const guideBeforeSwitch = await page.locator('#matching-guide-code').inputValue();
    const requestCount = requests.length; await switchTo('th'); await has(drugName); await has(patientName);
    assert.equal(await page.locator('#matching-guide-code').inputValue(), guideBeforeSwitch);
    assert.equal(await page.locator('#matching-medicine-code').inputValue(), 'unfinished medicine code'); assert.equal(requests.length, requestCount);
    await switchTo('en'); await page.getByRole('button', { name: 'Open note (note available)', exact: true }).click();
    await page.getByRole('dialog').waitFor(); assert.equal(await page.locator('#package-dispensing-note').inputValue(), note);
    await page.locator('#package-dispensing-note').fill('Unsaved form / ข้อความทดสอบ');
    await switchTo('th'); assert.equal(await page.locator('#package-dispensing-note').inputValue(), 'Unsaved form / ข้อความทดสอบ');
    await has('บันทึก / NOTE ถึงจุดจ่ายยา'); await switchTo('en'); await has('Note for Dispensing'); await shot('note-en');
    await page.getByRole('button', { name: 'Close note', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(requests.find(r => r.endpoint.endsWith('/note')).body.note, 'Unsaved form / ข้อความทดสอบ');
    await nav('Checking'); await page.locator('#checking-guide-code').waitFor(); await desktopHeader();
    await page.locator('#checking-guide-code').press('Enter'); await has('Enter a guide code');
    await switchTo('th'); await has('กรุณากรอกรหัสใบนำทาง'); await page.locator('#checking-guide-code').fill('GUIDE-2');
    await page.getByText(drugName, { exact: true }).waitFor(); await page.locator('#checking-drug-code').fill('unfinished barcode');
    await switchTo('en'); assert.equal(await page.locator('#checking-drug-code').inputValue(), 'unfinished barcode'); await has(drugName); await shot('checking-en');
    await nav('Dispensing'); await page.getByRole('heading', { name: 'Select a dispensing station to start' }).waitFor();
    await page.getByRole('button', { name: /^1 Available$/ }).click();
    await page.waitForFunction(() => {
      const toast = document.querySelector('[data-sonner-toast][data-type=success]');
      const header = document.querySelector('header');
      return toast && header && toast.getBoundingClientRect().top >= header.getBoundingClientRect().bottom;
    });
    await page.getByRole('button', { name: /VN VN-D/ }).click();
    await page.getByText(drugName, { exact: true }).waitFor(); await switchTo('th'); await has(drugName); await has(note); await switchTo('en'); await shot('dispensing-en');
    await nav('ข้อมูลยา'); await desktopHeader(); await page.getByRole('heading', { name: 'Add patient drug allergy', exact: true }).waitFor();
    await page.getByPlaceholder('Enter HN or patient name').fill('HN-01'); await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('button', { name: /Patient i18n.*HN HN-01/ }).click();
    await page.getByPlaceholder('Search drug code, brand or generic name').fill('DRUG-01'); await page.getByRole('button', { name: 'Find medication', exact: true }).click();
    await page.getByRole('button', { name: /Calcium Carbonate DRUG-01/ }).click();
    await page.getByPlaceholder('For example, itchy rash or breathing difficulty').fill('Typed reaction / ผื่นทดสอบ');
    await page.getByPlaceholder('Select or enter severity').fill('Mild'); await page.getByPlaceholder('Select or enter correlation').fill('Certain');
    await page.getByPlaceholder('Pharmacist or recorder name').fill('Test recorder');
    await switchTo('th'); assert.equal(await page.getByPlaceholder('เช่น ผื่นคัน หายใจติดขัด').inputValue(), 'Typed reaction / ผื่นทดสอบ');
    assert.equal(await page.locator('input[list="allergy-severity"]').inputValue(), 'Mild'); await switchTo('en');
    await page.getByRole('button', { name: 'Review before saving', exact: true }).click(); await page.getByRole('dialog').waitFor();
    await switchTo('th'); await has('ยืนยันการบันทึกข้อมูลแพ้ยา'); await has('Typed reaction / ผื่นทดสอบ');
    await switchTo('en'); await has('Confirm drug allergy record'); await shot('allergy-confirm-en'); await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Drug label settings', exact: true }).click(); await page.getByText('API template text / ข้อความฉลาก', { exact: true }).waitFor();
    await switchTo('th'); await has('API template text / ข้อความฉลาก'); await switchTo('en'); await shot('label-en');
    for (const label of ['Dashboard', 'ME Report']) { await nav(label); await siteFont(); await page.getByPlaceholder('ค้นหา VN, HN, ชื่อผู้ป่วย').waitFor();
      assert.equal(await page.getByRole('group', { name: /ภาษา|Language/, exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('pharmauto-language')), 'en');
      await has(label === 'Dashboard' ? 'ปริมาณงานแต่ละขั้นตอน' : 'การกระจายตามระดับความรุนแรง'); await shot(label === 'Dashboard' ? 'dashboard-legacy' : 'me-legacy'); }
    await nav('Verify'); await page.getByPlaceholder('Search VN, HN or patient name').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const label of ['Verify', 'Matching', 'Checking', 'Dispensing', 'ข้อมูลยา']) { console.log('Mobile checks:', label); await nav(label);
      for (const lang of ['en', 'th']) { await switchTo(lang); await noOverflow(); await siteFont(); await shot((label === 'ข้อมูลยา' ? 'drugmaster' : label.toLowerCase())+'-mobile-'+lang); } }
    assert.deepEqual(errors, []); assert.equal(requests.some(r => r.endpoint === '/drug-allergies'), false);
    console.log(JSON.stringify({ result: 'PASS', screenshots, checks: ['1920×1080 single-row header', 'requested Thai stage tabs and Verify check column', 'toasts leave header controls accessible', 'Chulabhorn Likit fonts across pages', 'TH→EN→TH','form state','route and refresh persistence','live validation','barcode state','Verify panel, HAD, Subjective, Verify ME, NOTE and allergy modals','raw API data and note payload','excluded pages','mobile overflow','no browser errors'] }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
