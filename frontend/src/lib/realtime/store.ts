import { ApiClientError, apiGet, apiPost, getApiBaseUrl } from "@/lib/api-client";
import { RealtimeCache } from "./cache";
import type { SyncFilter, SyncResponse, SyncStatus } from "./types";

export class RealtimeQueueStore {
  private cache=new RealtimeCache();
  private listeners=new Set<()=>void>();
  private cursor="";
  private generation=0;
  private running:Promise<void>|null=null;
  private syncAgain=false;
  private bootstrapRunning:Promise<void>|null=null;
  private backgroundRunning:Promise<void>|null=null;
  private pendingBackground:{snapshotId:string;next:string}|null=null;
  private eventSource:EventSource|null=null;
  private timer:ReturnType<typeof setInterval>|null=null;
  private expiryTimer:ReturnType<typeof setTimeout>|null=null;
  private controller=new AbortController();
  private active=false;
  private streamHealthy=false;
  private stamp="";
  private serverOffset=0;
  private lastEventAt=0;
  private lastSyncAt=0;
  state={...this.cache.data(),loading:true,backgroundStatus:"loading" as "loading"|"complete"|"error",
    connected:false,error:null as Error|null,updatedAt:null as string|null,syncing:false,datasetId:""};
  constructor(readonly filter:SyncFilter) {}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.state;
  private emit(patch:Partial<typeof this.state>={}) {
    this.state={...this.state,...patch}; this.listeners.forEach(listener=>listener());
  }
  private apply(response:SyncResponse, replace=false) {
    this.cache.apply(response);
    const changed=replace || response.UPSERTS.length>0;
    const data=changed || response.LOCKS.length>0 ? this.cache.data(Date.now()+this.serverOffset) : null;
    this.emit({...(changed ? data : data ? {workflows:data.workflows} : {}),datasetId:response.DATASET_ID,updatedAt:new Date().toISOString(),error:null});
    this.scheduleExpiry();
  }
  start() {
    if(this.active)return;
    this.active=true;this.controller=new AbortController();
    this.emit({connected:false});
    this.eventSource=new EventSource(`${getApiBaseUrl()}/realtime/events`);
    const receive=(event:MessageEvent<string>)=>{
      let status:SyncStatus;try{status=JSON.parse(event.data) as SyncStatus;}catch{return;}
      this.lastEventAt=Date.now();this.serverOffset=Date.parse(status.SERVER_TIME)-Date.now();
      this.streamHealthy=status.HEALTHY;
      if(this.state.datasetId && status.DATASET_ID!==this.state.datasetId) {
        this.cache=new RealtimeCache();this.cursor="";this.stamp="";this.pendingBackground=null;
        this.emit({...this.cache.data(),datasetId:status.DATASET_ID,connected:false,loading:true});
        void this.reload();return;
      }
      this.emit({connected:status.HEALTHY});
      const stamp=`${status.SOURCE_VERSION}|${status.WORKFLOW_VERSION}`;
      if(status.HEALTHY && stamp!==this.stamp) {this.stamp=stamp;void this.sync();}
    };
    this.eventSource.addEventListener("status",receive as EventListener);
    this.eventSource.addEventListener("changed",receive as EventListener);
    this.eventSource.onerror=()=>{this.streamHealthy=false;this.emit({connected:false});};
    this.timer=setInterval(()=>{
      if(!this.cursor && !this.bootstrapRunning) void this.reload();
      else if(!this.streamHealthy || Date.now()-this.lastEventAt>30000 || Date.now()-this.lastSyncAt>60000) void this.sync();
      if(this.pendingBackground && !this.bootstrapRunning) void this.resumeBackground();
    },5000);
    if(this.cursor) {void this.sync();void this.resumeBackground();}else void this.reload();
  }
  stop() {
    this.active=false;this.generation++;this.controller.abort();this.eventSource?.close();this.eventSource=null;
    if(this.timer)clearInterval(this.timer);if(this.expiryTimer)clearTimeout(this.expiryTimer);
    this.timer=null;this.expiryTimer=null;
    this.running=null;this.bootstrapRunning=null;this.backgroundRunning=null;
  }
  reload=async():Promise<void>=>{
    if(this.bootstrapRunning)return this.bootstrapRunning;
    const generation=++this.generation;this.cursor="";this.pendingBackground=null;this.controller.abort();this.controller=new AbortController();
    const signal=this.controller.signal;
    const work=(async()=>{
      try {
        this.emit({loading:this.cache.visits.size===0,backgroundStatus:"loading"});
        const first=await apiPost<SyncResponse>("/realtime/snapshots",this.filter,{signal});
        if(generation!==this.generation)return;
        this.cache=new RealtimeCache();this.cursor=first.CURSOR;this.apply(first,true);this.emit({loading:false});
        void this.sync();
        this.pendingBackground=first.NEXT_PAGE_CURSOR ? {snapshotId:first.SNAPSHOT_ID!,next:first.NEXT_PAGE_CURSOR} : null;
        if(this.pendingBackground) await this.resumeBackground();
        else this.emit({backgroundStatus:"complete"});
        if(generation===this.generation) await this.sync();
      }catch(error){if(!signal.aborted && generation===this.generation)this.emit({loading:false,backgroundStatus:"error",error:asError(error)});}
    })();
    this.bootstrapRunning=work;try{await work;}finally{if(this.bootstrapRunning===work)this.bootstrapRunning=null;}
  };
  private resumeBackground=async():Promise<void>=>{
    if(this.backgroundRunning)return this.backgroundRunning;
    if(!this.pendingBackground || !this.active)return;
    const generation=this.generation,signal=this.controller.signal;
    const work=(async()=>{
      try {
        this.emit({backgroundStatus:"loading"});
        while(this.pendingBackground && this.active && generation===this.generation) {
          const {snapshotId,next}=this.pendingBackground;
          const page=await apiGet<SyncResponse>(`/realtime/snapshots/${snapshotId}`,{query:{pageCursor:next},signal});
          if(generation!==this.generation)return;
          this.apply(page);
          this.pendingBackground=page.NEXT_PAGE_CURSOR ? {snapshotId,next:page.NEXT_PAGE_CURSOR} : null;
          // Background pages never overwrite the already advancing live cursor.
        }
        if(generation===this.generation)this.emit({backgroundStatus:"complete"});
      }catch(error){
        if(signal.aborted || generation!==this.generation)return;
        this.emit({backgroundStatus:"error",error:asError(error)});
        if(error instanceof ApiClientError && error.status===409){this.pendingBackground=null;this.cursor="";}
      }
    })();
    this.backgroundRunning=work;try{await work;}finally{if(this.backgroundRunning===work)this.backgroundRunning=null;}
  };
  sync=async():Promise<void>=>{
    if(this.running){this.syncAgain=true;return this.running;}
    if(!this.cursor || !this.active)return;
    const generation=this.generation,signal=this.controller.signal;
    const work=(async()=>{
      try {
        this.emit({syncing:true});
        let more=true;
        while(more && this.active && generation===this.generation) {
          const result=await apiGet<SyncResponse>("/realtime/changes",{query:{cursor:this.cursor},signal});
          if(generation!==this.generation)return;
          this.apply(result);this.cursor=result.CURSOR;more=result.HAS_MORE;
        }
        this.lastSyncAt=Date.now();this.emit({connected:true});
      }catch(error){
        if(signal.aborted || generation!==this.generation)return;
        this.emit({connected:false,error:asError(error)});
        if(error instanceof ApiClientError && error.status===409) {
          this.cursor="";setTimeout(()=>{if(this.active)void this.reload();},0);
        }
      }finally{if(generation===this.generation)this.emit({syncing:false});}
    })();
    this.running=work;try{await work;}finally{
      if(this.running===work){
        this.running=null;
        if(this.syncAgain){this.syncAgain=false;void this.sync();}
      }
    }
  };
  private scheduleExpiry() {
    if(this.expiryTimer)clearTimeout(this.expiryTimer);
    const now=Date.now()+this.serverOffset;
    const expirations=this.state.workflows.filter(w=>w.VERIFY_LOCK.IS_LOCKED && w.VERIFY_LOCK.EXPIRES_AT)
      .map(w=>Date.parse(w.VERIFY_LOCK.EXPIRES_AT!)).filter(t=>t>now);
    if(expirations.length)this.expiryTimer=setTimeout(()=>{
      this.emit(this.cache.data(Date.now()+this.serverOffset));this.scheduleExpiry();
    },Math.min(2147483647,Math.max(1,Math.min(...expirations)-now+20)));
  }
}
const asError=(error:unknown)=>error instanceof Error?error:new Error(String(error));
