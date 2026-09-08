"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { RealtimeQueueStore } from "@/lib/realtime/store";
import type { SyncFilter } from "@/lib/realtime/types";

const stores=new Map<string,{store:RealtimeQueueStore;usedAt:number}>();
export function clearRealtimeQueueCache() {
  for (const {store} of stores.values()) store.stop();
  stores.clear();
}
export function useRealtimeQueue(filter:SyncFilter) {
  const key=JSON.stringify([filter.fromDate,filter.toDate,filter.patientId,filter.visitNumber]);
  const store=useMemo(()=>{
    let entry=stores.get(key);
    if(!entry) {entry={store:new RealtimeQueueStore(JSON.parse(key).reduce((f:SyncFilter,value:string,index:number)=>{
      if(value)f[(["fromDate","toDate","patientId","visitNumber"] as const)[index]]=value;return f;
    },{})),usedAt:0};stores.set(key,entry);}
    return entry.store;
  },[key]);
  const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  useEffect(()=>{
    const entry=stores.get(key);if(entry)entry.usedAt=Date.now();
    for(const [oldKey,old] of stores) if(oldKey!==key && Date.now()-old.usedAt>5*60_000) {old.store.stop();stores.delete(oldKey);}
    store.start();return()=>{store.stop();const entry=stores.get(key);if(entry)entry.usedAt=Date.now();};
  },[store,key]);
  return {...state,sync:store.sync,reload:store.reload};
}
