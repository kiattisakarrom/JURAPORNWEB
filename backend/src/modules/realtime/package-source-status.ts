import type { PackageResponse } from '../package-workflow/interfaces/package-workflow-response.interface';
import type { VerifyPrescriptionPatient } from '../verify/interfaces/verify-prescriptions-response.interface';
import { sourceRevision } from '../verify/source-revision';

// Package rows/labels are immutable snapshots. This is a read-only projection.
export function withSourceStatus(pkg: PackageResponse, patients: VerifyPrescriptionPatient[], baseline?: string | null): PackageResponse {
  const source = patients.filter(p=>p.PATIENTID===pkg.PATIENTID).flatMap(p=>p.PRESCRIPTIONS)
    .filter(p=>p.VISITDATETIME===pkg.VISITDATETIME && p.VISITNUMBER===pkg.VISITNUMBER);
  const itemKey=(pn:string,code:string,seq:number)=>JSON.stringify([pn,code,seq]);
  const items=new Map(source.flatMap(p=>p.ITEMS.map(item=>[itemKey(p.PRESCRIPTIONNUMBER,item.MEDICINECODE,item.ITEMSEQ),item] as const)));
  const snapshotKeys=new Set(pkg.ITEMS.map(item=>itemKey(item.PRESCRIPTIONNUMBER,item.MEDICINECODE,item.ITEMSEQ)));
  const currentPatient=patients.find(p=>p.PATIENTID===pkg.PATIENTID);
  const changed=baseline ? !currentPatient || sourceRevision({...currentPatient,PRESCRIPTIONS:source})!==baseline : pkg.ITEMS.some(item=>{
    const latest=items.get(itemKey(item.PRESCRIPTIONNUMBER,item.MEDICINECODE,item.ITEMSEQ));
    return !latest || latest.ORDERQTY!==item.ORDERQTY || latest.ORDERUNITCODE!==item.ORDERUNITCODE
      || latest.DOSEMEMO_TH!==item.DOSEMEMO_TH || latest.COMMERCIALNAME!==item.COMMERCIALNAME;
  }) || source.some(p=>p.ITEMS.some(item=>!snapshotKeys.has(itemKey(p.PRESCRIPTIONNUMBER,item.MEDICINECODE,item.ITEMSEQ))
    && Date.parse(item.CREATEDATETIME??p.CREATEDATETIME??'')>Date.parse(pkg.CREATED_AT)));
  return {...pkg,SOURCE_CHANGED:changed,ITEMS:pkg.ITEMS.map(item=>({...item,
    ALERTS:items.get(itemKey(item.PRESCRIPTIONNUMBER,item.MEDICINECODE,item.ITEMSEQ))?.ALERTS??[],
  }))};
}
