/* Integration/load smoke test. Synthetic Local-only rows are removed in finally.
 * Run after npm run build and migration 005. Never targets Live. */
const fs = require('node:fs');
const { parseEnv } = require('node:util');
const { randomUUID, randomInt } = require('node:crypto');
const assert = require('node:assert/strict');
const sql = require('mssql');
const env = parseEnv(fs.readFileSync('.env.local', 'utf8'));
if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw new Error('Local database only');
Object.assign(process.env, env, { DB_PROFILE: 'local' });
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/app.module');
const { DatabaseService } = require('../dist/database/database.service');
const { RealtimeService } = require('../dist/modules/realtime/realtime.service');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const summary = { syntheticOnly: true, clients: 50, checks: [], timingsMs: {} };
let sqlRequestBatches = 0;
const originalQuery = sql.Request.prototype.query;
sql.Request.prototype.query = function (...args) {
  sqlRequestBatches++;
  return originalQuery.apply(this, args);
};
const run = randomUUID().replaceAll('-', '').slice(0, 5);
const hn = `RTH${run}`;
const vn = `RT${run}001`;
const codes = [`14${String(randomInt(10000000, 99999998))}`, '']; codes[1] = String(Number(codes[0]) + 1);
const streams = [];
let app, db, service, base, today, created = false;

async function query(statement, args = {}) {
  const request = db.createRequest();
  request.input('hn', sql.VarChar(15), hn);
  request.input('vn', sql.VarChar(10), vn);
  request.input('codeA', sql.VarChar(30), codes[0]);
  request.input('codeB', sql.VarChar(30), codes[1]);
  for (const [name, value] of Object.entries(args)) request.input(name, value);
  return request.query(statement);
}
async function api(path, body, method = body === undefined ? 'GET' : 'POST', expected) {
  const start = performance.now();
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  const data = JSON.parse(raw);
  if (expected !== undefined) assert.equal(response.status, expected, `${path}: ${response.status} ${JSON.stringify(data.message ?? '')}`);
  else assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data.message ?? '')}`);
  return { data, status: response.status, ms: performance.now() - start, bytes: Buffer.byteLength(raw) };
}
async function change(client) {
  const patches = [], locks = [];
  let bytes = 0;
  let more = true;
  while (more) {
    const result = await api('/realtime/changes?cursor=' + encodeURIComponent(client.cursor));
    const { data } = result; bytes += result.bytes;
    patches.push(...data.UPSERTS); locks.push(...data.LOCKS); client.cursor = data.CURSOR; more = data.HAS_MORE;
  }
  return { patches, locks, bytes };
}
async function openStream() {
  const controller = new AbortController();
  const stream = { controller, status: null, receivedAt: 0, ready: false };
  streams.push(stream);
  const response = await fetch(base + '/realtime/events', { signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  stream.task = (async () => {
    let buffer = '';
    try {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          const data = event.split('\n').find(line => line.startsWith('data:'));
          if (data) { stream.status = JSON.parse(data.slice(5)); stream.receivedAt = performance.now(); stream.ready = true; }
        }
      }
    } catch (error) { if (!controller.signal.aborted) throw error; }
  })();
  return stream;
}
async function waitFor(predicate, ms = 8000) {
  const deadline = performance.now() + ms;
  while (!predicate()) { if (performance.now() > deadline) throw new Error('Timed out waiting for realtime state'); await sleep(40); }
}
async function commitVersion() { return (await query('SELECT CONVERT(varchar(30),CHANGE_TRACKING_CURRENT_VERSION()) v')).recordset[0].v; }
async function observe(domain, version, start) {
  const field = domain === 'source' ? 'SOURCE_VERSION' : 'WORKFLOW_VERSION';
  await waitFor(() => streams.filter(s => !s.controller.signal.aborted).every(s => s.status && BigInt(s.status[field]) >= BigInt(version)));
  return Math.round(performance.now() - start);
}
async function insertPrescriptions(entries) {
  await query(`
    INSERT INTO dbo.TBLORX(CREATEDATETIME,VISITDATETIME,VISITNUMBER,PRESCRIPTIONNUMBER,PATIENTID,DOCTORORDERCODE,
      VISITQUEUE,RXQUEUE,ENTRYUSERBY,PRIORITY,ORDERSTATUS,READDATETIME,LASTCHANGE_AT,CLINIC_CODE)
    SELECT DATEADD(HOUR,7,SYSUTCDATETIME()),CONVERT(date,DATEADD(HOUR,7,SYSUTCDATETIME())),v.vn,v.pn,@hn,'TSTDR01',999,1,'REALTIME-TEST','NORMAL','ACTIVE',SYSDATETIME(),SYSDATETIME(),'TSTCLINIC'
    FROM OPENJSON(@entries) WITH (vn varchar(10),pn varchar(16),code varchar(30)) v;
    INSERT INTO dbo.TBLORXITEMS(CREATEDATETIME,VISITDATETIME,VISITNUMBER,PRESCRIPTIONNUMBER,MEDICINECODE,PATIENTID,
      ITEMSEQ,ORDERDATETIME,ORDERQTY,ORDERUNITCODE,ISLABELPRINT,PRINTNUM,LASTUPDATEDATETIME,USERCDE,READDATETIME,
      DOSEMEMO_TH,IS_EDITED,IS_DELETED,LASTCHANGE_BY,LASTCHANGE_AT)
    SELECT DATEADD(HOUR,7,SYSUTCDATETIME()),CONVERT(date,DATEADD(HOUR,7,SYSUTCDATETIME())),v.vn,v.pn,v.code,@hn,1,SYSDATETIME(),10,'TAB','N',0,SYSDATETIME(),
      'REALTIME-TEST',SYSDATETIME(),N'Synthetic test only',0,0,'REALTIME-TEST',SYSDATETIME()
    FROM OPENJSON(@entries) WITH (vn varchar(10),pn varchar(16),code varchar(30)) v;
  `, { entries: JSON.stringify(entries) });
}
function prescriptions(delta) { return delta.patches.flatMap(v => v.PATIENTS ?? []).flatMap(p => p.PRESCRIPTIONS); }
async function cleanup() {
  if (!created) return;
  await query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
    DELETE FROM dbo.TBLPACKAGEEVENTS WHERE WORKFLOW_ID IN (SELECT WORKFLOW_ID FROM dbo.TBLWORKFLOWMASTER WHERE PATIENTID=@hn);
    DELETE FROM dbo.TBLPACKAGEITEMS WHERE WORKFLOW_ID IN (SELECT WORKFLOW_ID FROM dbo.TBLWORKFLOWMASTER WHERE PATIENTID=@hn);
    DELETE FROM dbo.TBLPACKAGEMASTER WHERE WORKFLOW_ID IN (SELECT WORKFLOW_ID FROM dbo.TBLWORKFLOWMASTER WHERE PATIENTID=@hn);
    DELETE FROM dbo.TBLPACKAGEPRESCRIPTIONS WHERE WORKFLOW_ID IN (SELECT WORKFLOW_ID FROM dbo.TBLWORKFLOWMASTER WHERE PATIENTID=@hn);
    DELETE FROM dbo.TBLWORKFLOWMASTER WHERE PATIENTID=@hn;
    DELETE FROM dbo.TBLORXITEMS WHERE PATIENTID=@hn;
    DELETE FROM dbo.TBLORX WHERE PATIENTID=@hn AND ENTRYUSERBY='REALTIME-TEST';
    DELETE FROM dbo.TBLALLERGY WHERE HN=@hn;
    DELETE FROM dbo.DrugInteraction WHERE StockCode=@codeA AND WithStockCode=@codeB;
    DELETE FROM dbo.TBLPATIENT WHERE PATIENTID=@hn;
    DELETE FROM dbo.TBLMEDITEMSINFO WHERE MEDICINECODE IN (@codeA,@codeB);
    DELETE FROM dbo.TBLREALTIMEINVALIDATIONS WHERE (SCOPE_TYPE='PATIENT' AND SCOPE_KEY=@hn)
      OR (SCOPE_TYPE='MEDICINE' AND SCOPE_KEY IN (@codeA,@codeB));
    COMMIT;`);
  summary.cleanup = 'synthetic rows removed';
}
async function main() {
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api/v1'; db = app.get(DatabaseService); service = app.get(RealtimeService);
  today = (await query('SELECT CONVERT(varchar(10),DATEADD(HOUR,7,SYSUTCDATETIME()),23) today')).recordset[0].today;
  await query(`IF EXISTS (SELECT 1 FROM dbo.TBLPATIENT WHERE PATIENTID=@hn)
      OR EXISTS (SELECT 1 FROM dbo.TBLMEDITEMSINFO WHERE MEDICINECODE IN (@codeA,@codeB)) THROW 51000,'Test identifier collision',1;`);
  created = true;
  await query(`
    INSERT INTO dbo.TBLPATIENT(CREATEDATETIME,PATIENTID,FULLNAME_TH,FULLNAME_EN,FIRSTNAME_TH,LASTNAME_TH,GENDER,UPDATEDATETIMEMILLISEC,READDATETIME)
      VALUES(SYSDATETIME(),@hn,N'REALTIME SYNTHETIC',N'REALTIME SYNTHETIC',N'REALTIME',N'SYNTHETIC','U',SYSDATETIME(),SYSDATETIME());
    INSERT INTO dbo.TBLMEDITEMSINFO(CREATEDATETIME,MEDICINECODE,COMMERCIALNAME,GENERICNAME,LOCALNAME,STRENGTH,DOSAGEFORM,UNITSEN,UNITSTH,UPDATEDATETIMEMILLISEC,READDATETIME)
      VALUES(SYSDATETIME(),@codeA,N'Synthetic A',N'Synthetic A',N'Synthetic A','1','TABLET','TAB',N'TAB',SYSDATETIME(),SYSDATETIME()),
      (SYSDATETIME(),@codeB,N'Synthetic B',N'Synthetic B',N'Synthetic B','1','TABLET','TAB',N'TAB',SYSDATETIME(),SYSDATETIME());
  `);
  const filter = { fromDate: today, toDate: today, patientId: hn };
  await Promise.all(Array.from({ length: 50 }, () => openStream()));
  await waitFor(() => streams.every(s => s.ready && s.status.HEALTHY));
  const clients = await Promise.all(Array.from({ length: 50 }, async () => ({ cursor: (await api('/realtime/snapshots', filter)).data.CURSOR })));
  const beforeIdle = service.metrics.hydrationBatches;
  const idleQueries = sqlRequestBatches;
  await Promise.all(clients.map(change)); await sleep(600); await Promise.all(clients.map(change));
  summary.sqlRequestBatches = { idle100DeltaRequests: sqlRequestBatches - idleQueries };
  assert.equal(service.metrics.hydrationBatches, beforeIdle); summary.checks.push('50 idle clients: zero payload hydration');

  let start = performance.now();
  await insertPrescriptions([{ vn, pn: '01', code: codes[0] }]);
  summary.timingsMs.newVnSse50 = await observe('source', await commitVersion(), start);
  const beforeHydrate = service.metrics.hydrationBatches;
  const changedQueries = sqlRequestBatches;
  let deltas = await Promise.all(clients.map(change));
  summary.sqlRequestBatches.oneChangedVnFor50 = sqlRequestBatches - changedQueries;
  summary.responseBytes = { oneChangedVnPerClient: deltas[0].bytes };
  assert.ok(deltas.every(d => prescriptions(d).length === 1));
  summary.timingsMs.newVnApplied50 = Math.round(performance.now() - start);
  summary.sharedHydrationBatchesFor50 = service.metrics.hydrationBatches - beforeHydrate;
  summary.checks.push('new VN delivered to 50 clients');

  await insertPrescriptions([{ vn, pn: '02', code: codes[1] }]);
  let delta = await change(clients[0]); assert.equal(prescriptions(delta).length, 2);
  summary.checks.push('new PN in existing VN without changing VN count');
  await query(`INSERT INTO dbo.TBLALLERGY(CREATEDATETIME,HN,MEDICINECODE,SideEffect,ALLERGYTYPE,READDATETIME,severity,remarks)
    VALUES(SYSDATETIME(),@hn,@codeA,N'Test rash','Test',SYSDATETIME(),'Test',N'REALTIME-TEST');`);
  delta = await change(clients[0]);
  assert.ok(prescriptions(delta).flatMap(p => p.ITEMS).some(i => i.ALERTS.some(a => a.TYPE === 'AI')));
  await query(`INSERT INTO dbo.DrugInteraction(StockCode,EnglishName,LocalName,WithStockCode,WithStockCodeNameEN,WithStockCodeNameTH,
    LevelType,LevelTypeName,SeverityType,SeverityTypeName,EffectsMemo,MechanismMemo,ManagementMemo)
    VALUES(@codeA,N'Synthetic A',N'Synthetic A',@codeB,N'Synthetic B',N'Synthetic B',1,N'Test',1,N'Severe',N'REALTIME-TEST',N'Test',N'Test');`);
  delta = await change(clients[0]);
  let items = prescriptions(delta).flatMap(p => p.ITEMS);
  assert.equal(items.filter(i => i.ALERTS.some(a => a.TYPE === 'DI')).length, 2);
  assert.ok(items.some(i => i.ALERTS.some(a => a.TYPE === 'AI') && i.ALERTS.some(a => a.TYPE === 'DI')));
  await query('UPDATE dbo.DrugInteraction SET SeverityType=2,SeverityTypeName=N\'Moderate\' WHERE StockCode=@codeA AND WithStockCode=@codeB');
  delta = await change(clients[0]);assert.ok(prescriptions(delta).flatMap(p=>p.ITEMS).some(i=>i.ALERTS.some(a=>a.TYPE==='DI' && a.SEVERITY_TYPE===2)));
  summary.checks.push('AI, cross-PN DI, AI+DI, severity update');

  const claim = sessionId => api('/package-workflows/verify-lock', { visitDate: today, visitNumber: vn, sessionId, ownerName: 'Synthetic tester' }, 'POST', undefined);
  const attempts = await Promise.all(Array.from({ length: 10 }, async (_, i) => {
    const sessionId = `${run}-${i}`;
    const response = await fetch(base + '/package-workflows/verify-lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitDate: today, visitNumber: vn, sessionId }) });
    return { status: response.status, data: await response.json(), sessionId };
  }));
  assert.equal(attempts.filter(a=>a.status===201).length,1,`lock statuses: ${attempts.map(a=>a.status)}`);
  assert.ok(attempts.every(a=>a.status===201 || a.status===409));
  let owner = attempts.find(a=>a.status===201), workflowId = owner.data.WORKFLOW_ID;
  delta=await change(clients[0]);assert.ok(delta.patches.flatMap(p=>p.WORKFLOWS??[]).every(w=>w.VERIFY_LOCK.LOCK_TOKEN===null));
  const oldRevision=prescriptions(delta)[0].SOURCE_REVISION;
  start=performance.now();
  await api(`/package-workflows/${workflowId}/verify-lock/heartbeat?compact=true`,{lockToken:owner.data.VERIFY_LOCK.LOCK_TOKEN,sessionId:owner.sessionId});
  summary.timingsMs.heartbeatSse50=await observe('workflow',await commitVersion(),start);
  delta=await change(clients[0]);assert.equal(delta.patches.length,0);assert.equal(delta.locks.length,1);assert.equal(delta.locks[0].VERIFY_LOCK.LOCK_TOKEN,null);
  summary.checks.push('one owner under concurrent claims; heartbeat is lock-only; tokens private');
  await query('UPDATE dbo.TBLORXITEMS SET ORDERQTY=12 WHERE PATIENTID=@hn AND PRESCRIPTIONNUMBER=\'01\'');
  await api(`/package-workflows/${workflowId}/verify`,{lockToken:owner.data.VERIFY_LOCK.LOCK_TOKEN,sessionId:owner.sessionId,
    prescriptionNumber:'01',expectedSourceRevision:oldRevision,mode:'NORMAL',idempotencyKey:randomUUID()},'POST',409);
  await api(`/package-workflows/${workflowId}/verify-lock`,{lockToken:owner.data.VERIFY_LOCK.LOCK_TOKEN,sessionId:owner.sessionId},'DELETE');
  start=performance.now();await api('/package-workflows/pending',{visitDate:today,visitNumber:vn,reasonText:'Synthetic test'});
  summary.timingsMs.pendingSse50=await observe('workflow',await commitVersion(),start);
  deltas=await Promise.all(clients.map(change));
  assert.ok(deltas.every(d=>d.patches.some(p=>p.WORKFLOWS.some(w=>w.CASE_STATUS==='PENDING'))));
  await api(`/package-workflows/${workflowId}/return-to-verify`,{});
  summary.checks.push('stale source rejected with 409; Pending and return synced to all clients');

  let finalPackage;
  for(const pn of ['01','02']) {
    owner={...(await claim(`verify-${pn}`)),sessionId:`verify-${pn}`};
    delta=await change(clients[0]);
    const revision=prescriptions(delta)[0].SOURCE_REVISION;
    const body={lockToken:owner.data.VERIFY_LOCK.LOCK_TOKEN,sessionId:owner.sessionId,prescriptionNumber:pn,
      expectedSourceRevision:revision,mode:'NORMAL',idempotencyKey:randomUUID()};
    const result=(await api(`/package-workflows/${workflowId}/verify`,body)).data;
    assert.equal(result.PACKAGE_CREATED,pn==='02');
    if(pn==='02') {
      finalPackage=result.PACKAGE;
      assert.equal((await api(`/package-workflows/${workflowId}/verify`,body)).data.PACKAGE.PACKAGE_ID,finalPackage.PACKAGE_ID);
    }
  }
  summary.checks.push('normal multi-PN waits for last PN; retry creates no duplicate package');
  const packageId=finalPackage.PACKAGE_ID,originalQr=finalPackage.ITEMS[0].LABEL.QR_TOKEN;
  async function assertStageAll(stage) {
    const updates=await Promise.all(clients.map(change));
    assert.ok(updates.every(d=>d.patches.some(p=>p.PACKAGES.some(pkg=>pkg.PACKAGE_ID===packageId && pkg.PAGE_NOW===stage))),`${stage} must reach every client`);
  }
  await assertStageAll('PICKING');
  await query('UPDATE dbo.TBLORXITEMS SET ORDERQTY=13 WHERE PATIENTID=@hn AND PRESCRIPTIONNUMBER=\'01\'');
  delta=await change(clients[0]);const changedPackage=delta.patches.flatMap(p=>p.PACKAGES).find(p=>p.PACKAGE_ID===packageId);
  assert.equal(changedPackage.SOURCE_CHANGED,true);assert.equal(changedPackage.ITEMS[0].LABEL.QR_TOKEN,originalQr);assert.equal(changedPackage.ITEMS[0].ORDERQTY,12);
  await query('UPDATE dbo.TBLORXITEMS SET ORDERQTY=12 WHERE PATIENTID=@hn AND PRESCRIPTIONNUMBER=\'01\'');
  await api(`/packages/${packageId}/transitions`,{action:'SEND_TO_MATCHING'});
  await assertStageAll('MATCHING');
  for(const code of codes)finalPackage=(await api(`/packages/${packageId}/matching/scan`,{medicineCode:code})).data;
  await api(`/packages/${packageId}/transitions`,{action:'SEND_TO_CHECKING'});
  await assertStageAll('CHECKING');
  await api(`/packages/${packageId}/checking/validate-pair`,{medicineCode:codes[0],labelQrToken:'not-a-label'});
  for(const item of finalPackage.ITEMS)assert.equal((await api(`/packages/${packageId}/checking/validate-pair`,{medicineCode:item.MEDICINECODE,labelQrToken:item.LABEL.QR_TOKEN})).data.MATCHED,true);
  await api(`/packages/${packageId}/transitions`,{action:'SEND_TO_DISPENSING'});
  await assertStageAll('DISPENSING');
  await api(`/packages/${packageId}/dispensing/status`,{status:'CALLED_WAITING'});
  await api(`/packages/${packageId}/dispensing/status`,{status:'RECEIVED'});
  await assertStageAll('COMPLETE');
  summary.checks.push('source warning preserves labels; Picking → Matching → Checking → Dispensing → received');

  await query('DELETE FROM dbo.TBLALLERGY WHERE HN=@hn; DELETE FROM dbo.DrugInteraction WHERE StockCode=@codeA AND WithStockCode=@codeB;');
  delta=await change(clients[0]);assert.ok(prescriptions(delta).flatMap(p=>p.ITEMS).every(i=>i.ALERTS.length===0));
  summary.checks.push('deleting allergy/interaction removes alerts');

  for (const mode of ['NORMAL','URGENT']) {
    const testVn=`RT${run}${mode==='NORMAL'?'080':'081'}`;
    await insertPrescriptions([{vn:testVn,pn:'01',code:codes[0]},...(mode==='URGENT'?[{vn:testVn,pn:'02',code:codes[1]}]:[])]);
    const sessionId=`${run}-${mode}`;
    const locked=(await api('/package-workflows/verify-lock',{visitDate:today,visitNumber:testVn,sessionId})).data;
    delta=await change(clients[0]);
    const prescription=prescriptions(delta).find(p=>p.VISITNUMBER===testVn && p.PRESCRIPTIONNUMBER==='01');
    const result=(await api(`/package-workflows/${locked.WORKFLOW_ID}/verify`,{
      lockToken:locked.VERIFY_LOCK.LOCK_TOKEN,sessionId,prescriptionNumber:'01',expectedSourceRevision:prescription.SOURCE_REVISION,
      mode,packagePriority:mode,selectedItems:mode==='URGENT'?[{medicineCode:codes[0],itemSeq:1}]:undefined,idempotencyKey:randomUUID(),
    })).data;
    assert.equal(result.PACKAGE_CREATED,true);assert.equal(result.PACKAGE.ITEMS.length,1);
    delta=await change(clients[0]);
    assert.equal(delta.patches.flatMap(p=>p.PACKAGES).find(p=>p.PACKAGE_ID===result.PACKAGE.PACKAGE_ID).SOURCE_CHANGED,false);
    if(mode==='URGENT') {
      await insertPrescriptions([{vn:testVn,pn:'03',code:codes[0]}]);
      await query('UPDATE dbo.TBLORX SET CREATEDATETIME=DATEADD(DAY,-1,CREATEDATETIME) WHERE PATIENTID=@hn AND VISITNUMBER=@testVn AND PRESCRIPTIONNUMBER=\'03\'; UPDATE dbo.TBLORXITEMS SET CREATEDATETIME=DATEADD(DAY,-1,CREATEDATETIME) WHERE PATIENTID=@hn AND VISITNUMBER=@testVn AND PRESCRIPTIONNUMBER=\'03\';',{testVn});
      delta=await change(clients[0]);
      assert.equal(delta.patches.flatMap(p=>p.PACKAGES).find(p=>p.PACKAGE_ID===result.PACKAGE.PACKAGE_ID).SOURCE_CHANGED,true);
    }
  }
  summary.checks.push('single-PN normal sends immediately; urgent packages selected items before all PN verified');
  summary.checks.push('frozen package revision detects backdated PN additions without flagging unchanged urgent packages');

  const extra=Array.from({length:55},(_,i)=>({vn:`RT${run}${String(i+100).padStart(3,'0')}`,pn:'01',code:codes[0]}));
  await insertPrescriptions(extra);
  const page=(await api('/realtime/snapshots',filter)).data;
  assert.equal(page.UPSERTS.length,50);assert.ok(page.NEXT_PAGE_CURSOR);
  const inserted={vn:`RT${run}999`,pn:'01',code:codes[0]};await insertPrescriptions([inserted]);
  const removed=extra[0].vn;
  await query('DELETE FROM dbo.TBLORXITEMS WHERE PATIENTID=@hn AND VISITNUMBER=@removed; DELETE FROM dbo.TBLORX WHERE PATIENTID=@hn AND VISITNUMBER=@removed;',{removed});
  const keys=new Set(page.UPSERTS.filter(p=>p.PATIENTS.length).map(p=>p.VISITNUMBER));let next=page.NEXT_PAGE_CURSOR;
  while(next) {const data=(await api(`/realtime/snapshots/${page.SNAPSHOT_ID}?pageCursor=${next}`)).data;data.UPSERTS.forEach(p=>p.PATIENTS.length?keys.add(p.VISITNUMBER):keys.delete(p.VISITNUMBER));next=data.NEXT_PAGE_CURSOR;}
  const resumed={cursor:page.CURSOR};delta=await change(resumed);delta.patches.forEach(p=>p.PATIENTS.length?keys.add(p.VISITNUMBER):keys.delete(p.VISITNUMBER));
  assert.equal(keys.size,page.TOTAL_VISITS);assert.ok(keys.has(inserted.vn));assert.ok(!keys.has(removed));
  summary.checks.push('fixed 50-VN pagination survives concurrent insert/delete');

  const oldCursor=clients[1].cursor;streams[1].controller.abort();
  await query('UPDATE dbo.TBLORXITEMS SET ORDERQTY=15 WHERE PATIENTID=@hn AND VISITNUMBER=@vn AND PRESCRIPTIONNUMBER=\'01\'');
  await openStream();const resumedClient={cursor:oldCursor};delta=await change(resumedClient);
  assert.ok(prescriptions(delta).flatMap(p=>p.ITEMS).some(i=>i.ORDERQTY===15));
  summary.checks.push('disconnected client catches up from its cursor');
  const snapshotStart=performance.now();const measuredSnapshot=await api('/realtime/snapshots',filter);summary.timingsMs.snapshot50=Math.round(performance.now()-snapshotStart);
  const legacyStart=performance.now();const measuredLegacy=await api(`/verify/prescriptions?fromDate=${today}&toDate=${today}&patientId=${hn}&page=1&limit=50`);summary.timingsMs.legacyPage50=Math.round(performance.now()-legacyStart);
  const idleStart=performance.now();const measuredIdle=await change(resumedClient);summary.timingsMs.unchangedDelta=Math.round(performance.now()-idleStart);
  Object.assign(summary.responseBytes,{snapshot50:measuredSnapshot.bytes,legacyPage50:measuredLegacy.bytes,unchangedDelta:measuredIdle.bytes});
  summary.metrics={...service.metrics};
  // Restart the actual Nest app: process-local snapshot/cursor state is gone,
  // while the database and immutable packages remain unchanged.
  const cursorBeforeRestart=resumedClient.cursor;
  const datasetBeforeRestart=measuredSnapshot.data.DATASET_ID;
  streams.forEach(s=>s.controller.abort());
  await Promise.allSettled(streams.map(s=>s.task));
  await app.close();
  app=await NestFactory.create(AppModule,{logger:false});
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));
  await app.listen(0,'127.0.0.1');
  base=(await app.getUrl())+'/api/v1';db=app.get(DatabaseService);service=app.get(RealtimeService);
  await api('/realtime/changes?cursor='+encodeURIComponent(cursorBeforeRestart),undefined,'GET',409);
  const afterRestart=(await api('/realtime/snapshots',filter)).data;
  assert.equal(afterRestart.DATASET_ID,datasetBeforeRestart);assert.equal(afterRestart.UPSERTS.length,50);
  summary.checks.push('Backend restart rejects old cursor and supports a new 50-VN snapshot');
  const holdMs=Math.max(0,Math.min(180000,Number(process.env.REALTIME_UI_HOLD_MS)||0));
  if(holdMs) {
    console.log('Synthetic fixtures ready for Local browser QA; automatic cleanup follows.');
    await sleep(holdMs);
  }
}
main().catch(error=>{summary.failure=error.message;process.exitCode=1;}).finally(async()=>{
  streams.forEach(s=>s.controller.abort());
  await Promise.allSettled(streams.map(s=>s.task));
  try {await cleanup();}catch(error){summary.cleanupFailure=error.message;process.exitCode=1;}
  if(app)await app.close();
  sql.Request.prototype.query=originalQuery;
  console.log(JSON.stringify(summary,null,2));
});
