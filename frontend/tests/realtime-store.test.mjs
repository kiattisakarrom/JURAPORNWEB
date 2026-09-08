import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import ts from 'typescript';

// Actual store, deterministic network boundaries, no patient data or disk output.
function harness(api) {
  const intervals = new Set(), streams = [];
  class EventSourceStub {
    listeners = new Map();
    constructor() { streams.push(this); }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    close() {}
    changed(version) {
      this.listeners.get('changed')({data:JSON.stringify({DATASET_ID:'local',HEALTHY:true,
        SOURCE_VERSION:version,WORKFLOW_VERSION:version,SERVER_TIME:new Date().toISOString()})});
    }
  }
  const context = {Map,Set,Date,BigInt,AbortController,EventSource:EventSourceStub,setTimeout,clearTimeout,
    setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn)};
  const compile = (path, require) => {
    const exports = {};
    const result = ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{
      compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
    });
    new Script(result.outputText).runInNewContext({...context,exports,module:{exports},require});
    return exports;
  };
  const cache = compile('../src/lib/realtime/cache.ts',()=>{throw new Error('Unexpected cache import');});
  class ApiClientError extends Error {}
  const runtime = compile('../src/lib/realtime/store.ts',path=>{
    if(path==='./cache')return cache;
    if(path==='@/lib/api-client')return {...api,ApiClientError,getApiBaseUrl:()=>'/api/v1'};
    throw new Error(`Unexpected store import ${path}`);
  });
  return {store:new runtime.RealtimeQueueStore({fromDate:'2026-08-31',toDate:'2026-08-31'}),intervals,streams};
}
const response=(extra={})=>({DATASET_ID:'local',CURSOR:'c1',UPSERTS:[],LOCKS:[],REMOVED_KEYS:[],HAS_MORE:false,...extra});
const visit=vn=>({VISITDATETIME:'2026-08-31',VISITNUMBER:vn,REVISION:'1',
  PATIENTS:[{PATIENTID:'SYNTHETIC',FULLNAME_TH:'Test',PRESCRIPTIONS:[]}],WORKFLOWS:[],PACKAGES:[]});
async function until(check) {
  for(let i=0;i<100;i++) {if(check())return;await new Promise(resolve=>setImmediate(resolve));}
  assert.ok(check(),'Store did not settle');
}

test('interrupted background load resumes its page cursor without a new snapshot',async()=>{
  let snapshots=0,pages=0;
  const {store,intervals}=harness({
    apiPost:async()=>{snapshots++;return response({SNAPSHOT_ID:'snapshot',NEXT_PAGE_CURSOR:'50',UPSERTS:[visit('A')]});},
    apiGet:async(path,options)=>{
      if(path==='/realtime/changes')return response({CURSOR:'new-live-cursor'});
      assert.equal(options.query.pageCursor,'50');pages++;
      if(pages===1)throw new Error('Temporary network interruption');
      return response({CURSOR:'old-baseline',NEXT_PAGE_CURSOR:null,UPSERTS:[visit('B')]});
    },
  });
  try {
    store.start();await until(()=>store.getSnapshot().backgroundStatus==='error' && !store.bootstrapRunning);
    assert.equal(store.getSnapshot().patients.length,1);
    for(const tick of intervals)tick();
    await until(()=>store.getSnapshot().backgroundStatus==='complete');
    assert.equal(snapshots,1);assert.equal(pages,2);assert.equal(store.getSnapshot().patients.length,2);
    assert.equal(store.cursor,'new-live-cursor');
  } finally {store.stop();}
});

test('SSE arriving during a delta request triggers a trailing delta',async()=>{
  let calls=0,release,holdNext=false;
  const {store,streams}=harness({
    apiPost:async()=>response({SNAPSHOT_ID:'snapshot',NEXT_PAGE_CURSOR:null}),
    apiGet:async()=>{
      calls++;
      if(holdNext) {holdNext=false;return new Promise(resolve=>{release=()=>resolve(response({CURSOR:`c${calls}`}));});}
      return response({CURSOR:`c${calls}`});
    },
  });
  try {
    store.start();await until(()=>!store.getSnapshot().loading && !store.getSnapshot().syncing && !store.bootstrapRunning);
    const before=calls;holdNext=true;
    const pending=store.sync();await until(()=>Boolean(release));
    streams[0].changed('3');release();await pending;
    await until(()=>calls>=before+2 && !store.getSnapshot().syncing);
    assert.equal(store.cursor,`c${before+2}`);
  } finally {store.stop();}
});
