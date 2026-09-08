import type { LockPatch, SyncResponse, VisitPatch } from "./types";

export const visitKey = (v: Pick<VisitPatch,"VISITDATETIME"|"VISITNUMBER">) => `${v.VISITDATETIME.slice(0,10)}|${v.VISITNUMBER}`;
export class RealtimeCache {
  readonly visits = new Map<string,VisitPatch>();
  readonly locks = new Map<string,LockPatch>();
  datasetId = "";
  apply(response:SyncResponse) {
    if(this.datasetId && this.datasetId!==response.DATASET_ID) {this.visits.clear();this.locks.clear();}
    this.datasetId=response.DATASET_ID;
    for(const patch of response.UPSERTS) {
      const key=visitKey(patch),old=this.visits.get(key);
      if(!old || BigInt(patch.REVISION)>=BigInt(old.REVISION)) this.visits.set(key,patch);
      // Empty versioned buckets are retained as tombstones. Removing them here
      // would let an older background page resurrect a deleted visit.
    }
    for(const patch of response.LOCKS) {
      const old=this.locks.get(patch.WORKFLOW_ID);
      if(!old || BigInt(patch.REVISION)>=BigInt(old.REVISION)) this.locks.set(patch.WORKFLOW_ID,patch);
    }
  }
  data(serverNow=Date.now()) {
    const visits=Array.from(this.visits.values());
    return {
      patients:visits.flatMap(v=>v.PATIENTS??[]),
      packages:visits.flatMap(v=>v.PACKAGES??[]),
      workflows:visits.flatMap(v=>(v.WORKFLOWS??[]).map(w=>{
        const update=this.locks.get(w.WORKFLOW_ID);
        const lock=update && BigInt(update.REVISION)>=BigInt(v.REVISION)?update.VERIFY_LOCK:w.VERIFY_LOCK;
        const expired=Boolean(lock.EXPIRES_AT && Date.parse(lock.EXPIRES_AT)<=serverNow);
        return {...w,VERIFY_LOCK:expired?{...lock,IS_LOCKED:false}:lock};
      })),
    };
  }
}
