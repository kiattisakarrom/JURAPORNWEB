import * as sql from 'mssql';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { PackageWorkflowService } from '../package-workflow/package-workflow.service';
import { VerifyService } from '../verify/verify.service';
import { ChangeTrackingRepository } from './change-tracking.repository';
import { RealtimeService } from './realtime.service';
import { sourceRevision } from '../verify/source-revision';
import { withSourceStatus } from './package-source-status';
import type { VerifyPrescriptionPatient } from '../verify/interfaces/verify-prescriptions-response.interface';
import type { PackageResponse } from '../package-workflow/interfaces/package-workflow-response.interface';

describe('Realtime correctness',()=>{
  const patient={PATIENTID:'TEST',FULLNAME_TH:'Synthetic',PRESCRIPTIONS:[{
    VISITDATETIME:'2026-08-31',VISITNUMBER:'RT1',PRESCRIPTIONNUMBER:'01',CREATEDATETIME:'2026-08-31T00:00:00Z',
    CLINIC_CODE:null,LOCALWARDNAME:null,DOCTOR:{DOCTORCODE:null,LOCALDOCTORNAME:null},
    ITEMS:[{ITEMSEQ:1,CREATEDATETIME:null,MEDICINECODE:'1400000001',ORDERQTY:10,ORDERUNITCODE:'TAB',COMMERCIALNAME:'Test',DOSEMEMO_TH:'Test',ALERTS:[]}],
  }]} as VerifyPrescriptionPatient;
  it('ignores serialization order but detects changed quantity and clinical alerts',()=>{
    const revision=sourceRevision(patient);
    expect(sourceRevision({...patient,PRESCRIPTIONS:patient.PRESCRIPTIONS.map(p=>({...p,SOURCE_REVISION:'ignored'}))})).toBe(revision);
    const changed=structuredClone(patient);changed.PRESCRIPTIONS[0].ITEMS[0].ORDERQTY=11;
    expect(sourceRevision(changed)).not.toBe(revision);
    changed.PRESCRIPTIONS[0].ITEMS[0].ORDERQTY=10;
    changed.PRESCRIPTIONS[0].ITEMS[0].ALERTS=[{TYPE:'AI',SIDE_EFFECT:null,ALLERGY_TYPE:'test',SEVERITY:null,REACTION:null,REMARKS:null}];
    expect(sourceRevision(changed)).not.toBe(revision);
  });
  it('marks changed package source without rewriting a label or medication snapshot',()=>{
    const pkg={PATIENTID:'TEST',VISITDATETIME:'2026-08-31',VISITNUMBER:'RT1',CREATED_AT:'2026-08-31T01:00:00Z',
      ITEMS:[{...patient.PRESCRIPTIONS[0].ITEMS[0],PRESCRIPTIONNUMBER:'01',LABEL:{QR_TOKEN:'immutable'},ORDERQTY:9}]} as unknown as PackageResponse;
    const result=withSourceStatus(pkg,[patient]);
    expect(result.SOURCE_CHANGED).toBe(true);expect(result.ITEMS[0].ORDERQTY).toBe(9);
    expect(result.ITEMS[0].LABEL.QR_TOKEN).toBe('immutable');expect(pkg.SOURCE_CHANGED).toBeUndefined();
  });
  it('uses a frozen visit baseline for urgent packages and backdated additions',()=>{
    const pkg={PATIENTID:'TEST',VISITDATETIME:'2026-08-31',VISITNUMBER:'RT1',CREATED_AT:'2026-08-31T01:00:00Z',
      ITEMS:[{...patient.PRESCRIPTIONS[0].ITEMS[0],PRESCRIPTIONNUMBER:'01',LABEL:{QR_TOKEN:'immutable'}}]} as unknown as PackageResponse;
    const revision=sourceRevision(patient);
    expect(withSourceStatus(pkg,[patient],revision).SOURCE_CHANGED).toBe(false);
    const changed=structuredClone(patient);
    changed.PRESCRIPTIONS.push({...structuredClone(patient.PRESCRIPTIONS[0]),PRESCRIPTIONNUMBER:'02'});
    expect(withSourceStatus(pkg,[changed],revision).SOURCE_CHANGED).toBe(true);
    const extraAtCreation=sourceRevision(changed);
    expect(withSourceStatus(pkg,[changed],extraAtCreation).SOURCE_CHANGED).toBe(false);
  });
  it('does not query prescription payloads when the committed version is unchanged',async()=>{
    const request={input:jest.fn().mockReturnThis(),query:jest.fn()
      .mockResolvedValueOnce({recordset:[{version:'9007199254740995',ready:11,alertsReady:2}]})
      .mockResolvedValueOnce({recordset:[{invalid:0}]})};
    const db={withTransaction:jest.fn(async(work: (create:()=>unknown)=>Promise<unknown>)=>work(()=>request))} as unknown as DatabaseService;
    const result=await new ChangeTrackingRepository(db).read('source','9007199254740995');
    expect(result.visits).toEqual([]);expect(request.query).toHaveBeenCalledTimes(2);
    expect(db.withTransaction).toHaveBeenCalledWith(expect.any(Function),sql.ISOLATION_LEVEL.SNAPSHOT);
  });
  it('requires resync for a cursor older than CT retention',async()=>{
    const request={input:jest.fn().mockReturnThis(),query:jest.fn()
      .mockResolvedValueOnce({recordset:[{version:'500',ready:11,alertsReady:2}]})
      .mockResolvedValueOnce({recordset:[{invalid:1}]})};
    const db={withTransaction:jest.fn(async(work:(create:()=>unknown)=>Promise<unknown>)=>work(()=>request))} as unknown as DatabaseService;
    expect((await new ChangeTrackingRepository(db).read('workflow','1')).reset).toBe(true);
  });
  it('loads snapshot pages in FIFO order using the first prescription time',async()=>{
    let manifestSql='';
    const request={input:jest.fn().mockReturnThis(),query:jest.fn().mockImplementation(async(query:string)=>{
      manifestSql=query;return {recordset:[]};
    })};
    const db={withTransaction:jest.fn(async(work:(create:()=>unknown)=>Promise<unknown>)=>work(()=>request))} as unknown as DatabaseService;
    const tracker={version:jest.fn().mockResolvedValue('10')} as unknown as ChangeTrackingRepository;
    const verify={findVisitsPrescriptions:jest.fn().mockResolvedValue([])} as unknown as VerifyService;
    const workflow={findWorkflows:jest.fn().mockResolvedValue([]),findPackages:jest.fn().mockResolvedValue([])} as unknown as PackageWorkflowService;
    const config={get:jest.fn().mockReturnValue('test')} as unknown as ConfigService;
    const service=new RealtimeService(db,tracker,verify,workflow,config);

    await service.snapshot({fromDate:'2026-09-09',toDate:'2026-09-09'});

    expect(manifestSql).toContain('MIN(o.CREATEDATETIME) AS SORT_AT');
    expect(manifestSql).toContain('MIN(SORT_AT) ASC');
    expect(manifestSql).not.toContain('MAX(SORT_AT) DESC');
  });
});
