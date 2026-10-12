import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));
const file = path.join(sourceRoot, 'i18n/messages.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const loaded = new Module(file);
loaded.filename = file;
loaded.paths = Module._nodeModulePaths(path.dirname(file));
loaded._compile(compiled, file);
const { resources, createTranslator, uiMessage, resolveMessage, readLanguage, isExcludedPath, LANGUAGE_STORAGE_KEY, frontendErrorMessage } = loaded.exports;

test('TH/EN/legacy have identical keys and interpolation parameters', () => {
  const keys = Object.keys(resources.th).sort();
  assert.deepEqual(Object.keys(resources.en).sort(), keys);
  assert.deepEqual(Object.keys(resources.legacy).sort(), keys);
  const params = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const key of keys) {
    assert.ok(resources.th[key] && resources.en[key] && resources.legacy[key], key);
    assert.deepEqual(params(resources.th[key]), params(resources.en[key]), key);
    assert.deepEqual(params(resources.th[key]), params(resources.legacy[key]), key);
  }
});

test('existing validation and nested notification messages switch both directions', () => {
  const validation = uiMessage('workflow.enterAGuideCode');
  const notice = uiMessage('queue.thisVnIsBeingUsedBy', { p0: uiMessage('common.anotherUser') });
  const th = createTranslator('th');
  const en = createTranslator('en');
  assert.equal(resolveMessage(validation, th), 'กรุณากรอกรหัสใบนำทาง');
  assert.equal(resolveMessage(validation, en), 'Enter a guide code');
  assert.equal(resolveMessage(validation, th), 'กรุณากรอกรหัสใบนำทาง');
  assert.equal(resolveMessage(notice, en), 'This VN is being used by Another user');
  assert.equal(resolveMessage(notice, th), 'VN นี้กำลังใช้งานโดย ผู้ใช้อื่น');
});

test('API values and user input remain raw, including values identical to UI text', () => {
  for (const language of ['th', 'en']) {
    const t = createTranslator(language);
    for (const value of ['Calcium Carbonate', 'บันทึกแล้ว', 'Patient i18n', 'HN-01', 'PN-01', 'QR-01', 'WAITING_CALL', 'รอรับยา', 'typed note / ข้อความ']) {
      assert.equal(resolveMessage(value, t), value);
    }
    assert.equal(t('queue.pnVerifiedAwaitingMorePn', { p0: 'PN-01', p1: 2 }).includes('PN-01'), true);
  }
});

test('preference persists, invalid preference and blocked storage fall back to Thai', () => {
  const values = new Map([[LANGUAGE_STORAGE_KEY, 'en']]);
  assert.equal(readLanguage({ getItem: key => values.get(key) }), 'en');
  values.set(LANGUAGE_STORAGE_KEY, 'th');
  assert.equal(readLanguage({ getItem: key => values.get(key) }), 'th');
  assert.equal(readLanguage({ getItem: () => 'invalid' }), 'th');
  assert.equal(readLanguage({ getItem: () => { throw Error('blocked'); } }), 'th');
});

test('excluded routes preserve original shared text for either preference', () => {
  for (const route of ['/dashboard', '/dashboard/', '/me-report', '/me-report/']) assert.equal(isExcludedPath(route), true);
  for (const route of ['/verify', '/matching', '/checking', '/dispensing', '/drugmaster', '/dashboard-other']) assert.equal(isExcludedPath(route), false);
  for (const language of ['th', 'en']) {
    const t = createTranslator(language, true);
    for (const [key, original] of Object.entries(resources.legacy)) assert.equal(t(key), original, key);
    assert.equal(t('shell.signOut'), 'ออก');
    assert.equal(t('shell.searchVnHnOrPatientName'), 'ค้นหา VN, HN, ชื่อผู้ป่วย');
  }
});

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]);
test('every literal translation key used in source exists', () => {
  let count = 0;
  for (const file of walk(sourceRoot).filter(file => /\.tsx?$/.test(file))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), 99, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isCallExpression(node) && ['t', 'uiMessage'].includes(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0])) {
        count++;
        assert.ok(node.arguments[0].text in resources.th, `${file}: ${node.arguments[0].text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.ok(count > 500);
});


test('only explicit frontend error metadata is translated; backend errors remain raw', () => {
  const fallback = uiMessage('queue.anUnknownErrorOccurred');
  const localError = Object.assign(new Error('สิทธิ์ล็อก Verify เปลี่ยนแล้ว'), {
    uiMessage: uiMessage('verify.lockPermissionChanged'),
  });
  assert.equal(resolveMessage(frontendErrorMessage(localError, fallback), createTranslator('en')), 'Verify lock permission changed');
  assert.equal(localError.message, 'สิทธิ์ล็อก Verify เปลี่ยนแล้ว');
  const serverError = new Error('สิทธิ์ล็อก Verify เปลี่ยนแล้ว');
  assert.equal(frontendErrorMessage(serverError, fallback), serverError.message);
  assert.equal(frontendErrorMessage(new Error('Calcium Carbonate / server error'), fallback), 'Calcium Carbonate / server error');
  assert.equal(frontendErrorMessage(null, fallback), fallback);
});


test('API errors preserve backend messages and contracts, and local fallback has metadata', async () => {
  const filename = path.join(sourceRoot, 'lib/api-client.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const api = new Module(filename);
  api.filename = filename;
  api.paths = Module._nodeModulePaths(path.dirname(filename));
  api._compile(code, filename);
  const originalFetch = globalThis.fetch;
  try {
    for (const body of [{ message: 'API error / ข้อความจาก API' }, { message: ['raw error one', 'raw error two'] }, 'raw server text', { other: 'no message' }]) {
      globalThis.fetch = async () => new Response(JSON.stringify(body), { status: 503, headers: { 'Content-Type': 'application/json' } });
      await assert.rejects(api.exports.apiGet('/test'), error => {
        assert.equal(error instanceof api.exports.ApiClientError, true);
        assert.equal(error.status, 503);
        assert.deepEqual(error.details, body);
        if (typeof body === 'object' && !('message' in body)) {
          assert.equal(error.message, 'API request failed with status 503');
          assert.equal(resolveMessage(frontendErrorMessage(error, uiMessage('queue.anUnknownErrorOccurred')), createTranslator('en')), 'API request failed with status 503');
          assert.ok(resolveMessage(error.uiMessage, createTranslator('th')).includes('503'));
        } else assert.equal(error.uiMessage, undefined);
        return true;
      });
    }
  } finally { globalThis.fetch = originalFetch; }
});


test('Thai workflow labels match requested terminology while English and legacy stay unchanged', () => {
  const cases = [
    ['common.verify', 'ตรวจ', 'Verify'], ['queue.picking', 'หยิบยา', 'Picking'],
    ['common.matching', 'จับคู่', 'Matching'], ['common.checking', 'ตรวจสอบ', 'Checking'],
    ['common.dispensing', 'จ่ายยา', 'Dispensing'], ['common.pending', 'รอดำเนินการ', 'Pending'],
    ['queue.complete', 'สำเร็จ', 'Complete'], ['common.missedCall', 'เรียกไม่พบ', 'Missed-call'],
  ];
  for (const [key, thai, english] of cases) {
    assert.equal(createTranslator('th')(key), thai);
    assert.equal(createTranslator('en')(key), english);
    assert.equal(createTranslator('th', true)(key), resources.legacy[key]);
  }
});
