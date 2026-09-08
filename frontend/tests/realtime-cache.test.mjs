import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeCache } from '../src/lib/realtime/cache.ts';

const visit=(revision,patients=[])=>({VISITDATETIME:'2026-08-31',VISITNUMBER:'TEST',REVISION:revision,PATIENTS:patients,WORKFLOWS:[],PACKAGES:[]});
const response=(patches=[],locks=[],dataset='local')=>({DATASET_ID:dataset,CURSOR:'cursor',UPSERTS:patches,LOCKS:locks,REMOVED_KEYS:[],HAS_MORE:false});
test('older background data cannot overwrite an updated VN',()=>{
 const cache=new RealtimeCache();cache.apply(response([visit('9007199254740995',[{PATIENTID:'new'}])]));
 cache.apply(response([visit('9007199254740994',[{PATIENTID:'old'}])]));
 assert.equal(cache.data().patients[0].PATIENTID,'new');
});
test('tombstones prevent deleted rows reappearing from background pages',()=>{
 const cache=new RealtimeCache();cache.apply(response([visit('10')]));cache.apply(response([visit('9',[{PATIENTID:'deleted'}])]));
 assert.equal(cache.data().patients.length,0);
});
test('same VN on another date remains a different visit',()=>{
 const cache=new RealtimeCache();cache.apply(response([visit('1',[{PATIENTID:'A'}]),{...visit('1',[{PATIENTID:'B'}]),VISITDATETIME:'2026-08-30'}]));
 assert.equal(cache.data().patients.length,2);
});
test('switching Local/Live removes previous dataset contents',()=>{
 const cache=new RealtimeCache();cache.apply(response([visit('100',[{PATIENTID:'local'}])]));cache.apply(response([],[],'live'));
 assert.equal(cache.data().patients.length,0);
});
test('heartbeat updates only the latest lock and expiry is reflected without a reload',()=>{
 const cache=new RealtimeCache();const lock={LOCK_TOKEN:null,SESSION_ID:'owner',IS_LOCKED:true,EXPIRES_AT:'2026-08-31T02:00:00Z'};
 cache.apply(response([{...visit('10'),WORKFLOWS:[{WORKFLOW_ID:'wf',VERIFY_LOCK:lock}]}]));
 cache.apply(response([],[{WORKFLOW_ID:'wf',REVISION:'11',VERIFY_LOCK:{...lock,EXPIRES_AT:'2026-08-31T03:00:00Z'}}]));
 cache.apply(response([],[{WORKFLOW_ID:'wf',REVISION:'9',VERIFY_LOCK:{...lock,IS_LOCKED:false}}]));
 assert.equal(cache.data(Date.parse('2026-08-31T02:30:00Z')).workflows[0].VERIFY_LOCK.IS_LOCKED,true);
 assert.equal(cache.data(Date.parse('2026-08-31T03:00:01Z')).workflows[0].VERIFY_LOCK.IS_LOCKED,false);
});
