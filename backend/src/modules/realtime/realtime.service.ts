import { BadRequestException, ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import * as sql from 'mssql';
import { Subject, Subscription } from 'rxjs';
import { DatabaseService } from '../../database/database.service';
import { VerifyService } from '../verify/verify.service';
import { PackageWorkflowService } from '../package-workflow/package-workflow.service';
import { ChangeTrackingRepository } from './change-tracking.repository';
import { withSourceStatus } from './package-source-status';
import { visitKey, type ChangeBatch, type Domain, type LockPatch, type SyncFilter, type SyncResponse, type VersionedVisit, type VisitKey } from './realtime.types';

type Session = { id: string; filter: SyncFilter; keys: VisitKey[]; known: Set<string>; version: string; expires: number };
type Cursor = { id: string; s: string; w: string; window?: string; offset?: number };
type DeltaWindow = { session: string; keys: VisitKey[]; locks: string[]; s: string; w: string; expires: number };
const TTL = 30 * 60_000;
const PAGE_SIZE = 50;

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  readonly events = new Subject<{ type: string; data: object }>();
  readonly metrics = { metadataPolls: 0, hydrationBatches: 0, hydratedVisits: 0, snapshots: 0, deltaRequests: 0 };
  readonly datasetId: string;
  private readonly logger = new Logger(RealtimeService.name);
  private readonly secret = randomUUID();
  private readonly sessions = new Map<string, Session>();
  private readonly windows = new Map<string, DeltaWindow>();
  private readonly cache = new Map<string, { expires: number; promise: Promise<unknown> }>();
  private readonly running: Partial<Record<Domain, Promise<void>>> = {};
  private versions = { source: '0', workflow: '0' };
  private timers: ReturnType<typeof setInterval>[] = [];
  private subscription?: Subscription;
  private healthy = false;

  constructor(private readonly db: DatabaseService, private readonly tracker: ChangeTrackingRepository,
    private readonly verify: VerifyService, private readonly workflow: PackageWorkflowService, config: ConfigService) {
    this.datasetId = createHash('sha256').update(['DB_PROFILE','DB_HOST','DB_PORT','DB_NAME','REALTIME_DATASET_EPOCH']
      .map(key => config.get<string>(key) ?? '').join('|')).digest('hex').slice(0, 24);
  }

  onModuleInit(): void {
    const poll = (domain: Domain) => { void this.poll(domain).catch(() => undefined); };
    poll('source'); poll('workflow');
    this.timers = [setInterval(() => poll('source'), 5000), setInterval(() => poll('workflow'), 1000),
      setInterval(() => { this.clean(); this.events.next({ type: 'status', data: this.status() }); }, 15000)];
    this.subscription = this.db.commits.subscribe(() => poll('workflow'));
  }
  onModuleDestroy(): void {
    this.timers.forEach(clearInterval); this.subscription?.unsubscribe(); this.events.complete();
  }
  status() {
    return { DATASET_ID: this.datasetId, SOURCE_VERSION: this.versions.source, WORKFLOW_VERSION: this.versions.workflow,
      HEALTHY: this.healthy, SERVER_TIME: new Date().toISOString() };
  }

  async poll(domain: Domain): Promise<void> {
    if (this.running[domain]) return this.running[domain];
    const work = (async () => {
      try {
        this.metrics.metadataPolls++;
        const before = this.versions[domain];
        const changes = await this.tracker.read(domain, before);
        this.versions[domain] = changes.version;
        this.healthy = true;
        if (before !== changes.version || changes.reset) this.events.next({ type: 'changed', data: this.status() });
      } catch (error) {
        if (this.healthy) this.logger.warn('Realtime change tracking unavailable; clients must treat cached data as stale.');
        this.healthy = false;
        this.events.next({ type: 'status', data: this.status() });
        throw error;
      }
    })();
    this.running[domain] = work;
    try { await work; } finally { delete this.running[domain]; }
  }

  async snapshot(filter: SyncFilter): Promise<SyncResponse> {
    this.validate(filter); this.clean(); this.metrics.snapshots++;
    const normalized = { fromDate: filter.fromDate, toDate: filter.toDate, patientId: filter.patientId, visitNumber: filter.visitNumber };
    const manifest = await this.shared(`manifest:${JSON.stringify(normalized)}`, 1000, () => this.db.withTransaction(async createRequest => {
      const version = await this.tracker.version(createRequest);
      const request = createRequest();
      this.bindFilter(request, normalized);
      const rows = await request.query<{ VISITDATETIME: Date; VISITNUMBER: string }>(`
        WITH Visits AS (
          SELECT o.VISITDATETIME,o.VISITNUMBER,MIN(o.CREATEDATETIME) AS SORT_AT FROM dbo.TBLORX o
          WHERE o.PATIENTID IS NOT NULL AND (@patientId IS NULL OR o.PATIENTID=@patientId)
          AND (@visitNumber IS NULL OR o.VISITNUMBER=@visitNumber)
          AND (@fromDate IS NULL OR (o.CREATEDATETIME>=@fromDate AND o.CREATEDATETIME<DATEADD(DAY,1,@toDate)))
          GROUP BY o.VISITDATETIME,o.VISITNUMBER
          UNION ALL
          SELECT w.VISITDATETIME,w.VISITNUMBER,w.CREATED_AT FROM dbo.TBLWORKFLOWMASTER w
          WHERE (@patientId IS NULL OR w.PATIENTID=@patientId) AND (@visitNumber IS NULL OR w.VISITNUMBER=@visitNumber)
          AND (@fromDate IS NULL OR (w.VISITDATETIME>=@fromDate AND w.VISITDATETIME<=@toDate))
        ) SELECT VISITDATETIME,VISITNUMBER FROM Visits GROUP BY VISITDATETIME,VISITNUMBER
        ORDER BY CASE WHEN MIN(SORT_AT) IS NULL THEN 1 ELSE 0 END,MIN(SORT_AT) ASC,VISITDATETIME ASC,VISITNUMBER;
      `);
      return { version, keys: rows.recordset.map(row => ({ VISITDATETIME: row.VISITDATETIME.toISOString().slice(0,10), VISITNUMBER: row.VISITNUMBER })) };
    }, sql.ISOLATION_LEVEL.SNAPSHOT));
    const id = randomUUID();
    this.sessions.set(id, { id, filter: normalized, ...manifest, known: new Set(manifest.keys.map(visitKey)), expires: Date.now()+TTL });
    return this.page(id, 0);
  }

  async page(id: string, offset: number): Promise<SyncResponse> {
    const session = this.session(id);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > session.keys.length) throw new BadRequestException('Invalid page cursor');
    const keys = session.keys.slice(offset, offset + PAGE_SIZE);
    const patches = await this.hydrate(keys, session.filter, session.version);
    return { DATASET_ID: this.datasetId, CURSOR: this.encode({ id, s: session.version, w: session.version }),
      UPSERTS: patches, LOCKS: [], REMOVED_KEYS: [], HAS_MORE: offset+PAGE_SIZE < session.keys.length,
      SNAPSHOT_ID: id, PAGE_CURSOR: String(offset), NEXT_PAGE_CURSOR: offset+PAGE_SIZE < session.keys.length ? String(offset+PAGE_SIZE) : null,
      TOTAL_VISITS: session.keys.length };
  }

  async changes(token: string): Promise<SyncResponse> {
    this.metrics.deltaRequests++;
    const cursor = this.decode(token), session = this.session(cursor.id);
    let windowId = cursor.window, window = windowId ? this.windows.get(windowId) : undefined;
    if (windowId && (!window || window.session !== session.id || window.expires < Date.now())) this.resync();
    if (!window) {
      const head = await this.shared('committed-head', 0, () => this.tracker.version(() => this.db.createRequest()));
      // Concurrent clients share each metadata enumeration; no full list reads.
      const [source, workflow] = await Promise.all([
        this.shared<ChangeBatch>(`changes:source:${cursor.s}:${head}`, 500, () => this.tracker.read('source', cursor.s)),
        this.shared<ChangeBatch>(`changes:workflow:${cursor.w}:${head}`, 250, () => this.tracker.read('workflow', cursor.w)),
      ]);
      if (source.reset || workflow.reset) this.resync();
      const all = new Map([...source.visits,...workflow.visits].map(key => [visitKey(key),key]));
      const requiredVersion = BigInt(source.version)>BigInt(workflow.version) ? source.version : workflow.version;
      const keys = await this.relevant(Array.from(all.values()), session, requiredVersion);
      windowId = randomUUID();
      window = { session: session.id, keys, locks: workflow.lockIds, s: source.version, w: workflow.version, expires: Date.now()+TTL };
      this.windows.set(windowId, window);
    }
    const offset = cursor.offset ?? 0;
    const requiredVersion = BigInt(window.s)>BigInt(window.w) ? window.s : window.w;
    const patches = await this.hydrate(window.keys.slice(offset, offset+PAGE_SIZE), session.filter, requiredVersion);
    const locks = offset === 0 ? await this.locks(window.locks, window.w, session) : [];
    patches.forEach(patch => session.known.add(visitKey(patch)));
    const hasMore = offset+PAGE_SIZE < window.keys.length;
    return { DATASET_ID: this.datasetId, CURSOR: this.encode(hasMore
      ? { ...cursor, window: windowId, offset: offset+PAGE_SIZE }
      : { id: cursor.id, s: window.s, w: window.w }),
      UPSERTS: patches, LOCKS: locks, REMOVED_KEYS: patches.filter(p => !p.PATIENTS?.length && !p.WORKFLOWS?.length && !p.PACKAGES?.length).map(p => ({ VISITDATETIME:p.VISITDATETIME,VISITNUMBER:p.VISITNUMBER })), HAS_MORE: hasMore };
  }

  private async hydrate(keys: VisitKey[], filter: SyncFilter, requiredVersion: string): Promise<VersionedVisit[]> {
    if (!keys.length) return [];
    // Version participates in the shared key; completed stale reads cannot be reused
    // across an observed change. Each payload carries the version actually read.
    const key = `data:${requiredVersion}:${JSON.stringify(filter)}:${keys.map(visitKey).sort().join(',')}`;
    return this.shared(key, 250, () => this.db.withTransaction(async createRequest => {
      this.metrics.hydrationBatches++; this.metrics.hydratedVisits += keys.length;
      const version = await this.tracker.version(createRequest);
      if (BigInt(version)<BigInt(requiredVersion)) this.resync();
      const patients = await this.verify.findVisitsPrescriptions(keys, createRequest);
      const scope = { visits: keys, createRequest };
      const workflows = await this.workflow.findWorkflows({ limit: 2147483647 }, scope);
      const packageRows = await this.workflow.findPackages({ limit: 2147483647 }, scope);
      const baselines = new Map<string,string|null>();
      if(packageRows.length) {
        const request=createRequest();request.input('packageIds',sql.NVarChar(sql.MAX),JSON.stringify(packageRows.map(pkg=>pkg.PACKAGE_ID)));
        const rows=await request.query<{PACKAGE_ID:string; BASELINE:string|null}>(`
          SELECT CONVERT(varchar(36),PACKAGE_ID) PACKAGE_ID,
            JSON_VALUE(CASE WHEN ISJSON(EVENT_DATA)=1 THEN EVENT_DATA ELSE '{}' END,'$.sourceRevisionAtCreation') BASELINE
          FROM dbo.TBLPACKAGEEVENTS WHERE EVENT_TYPE='PACKAGE_CREATED'
          AND PACKAGE_ID IN (SELECT CONVERT(uniqueidentifier,value) FROM OPENJSON(@packageIds));
        `);
        rows.recordset.forEach(row=>baselines.set(row.PACKAGE_ID.toLowerCase(),row.BASELINE));
      }
      const packages=packageRows.map(pkg=>withSourceStatus(pkg,patients,baselines.get(pkg.PACKAGE_ID.toLowerCase())));
      return keys.map(visit => {
        const source = patients.map(patient => ({ ...patient, PRESCRIPTIONS: patient.PRESCRIPTIONS.filter(p => visitKey(p)===visitKey(visit)) }))
          .filter(patient => patient.PRESCRIPTIONS.length && (!filter.patientId || patient.PATIENTID===filter.patientId)
            && (!filter.fromDate || patient.PRESCRIPTIONS.some(p => p.CREATEDATETIME && p.CREATEDATETIME.slice(0,10)>=filter.fromDate! && p.CREATEDATETIME.slice(0,10)<=filter.toDate!)));
        const inRange = !filter.fromDate || (visit.VISITDATETIME>=filter.fromDate && visit.VISITDATETIME<=filter.toDate!);
        return { ...visit, REVISION: version, PATIENTS: source,
          WORKFLOWS: workflows.filter(w => inRange && visitKey(w)===visitKey(visit) && (!filter.patientId || w.PATIENTID===filter.patientId)),
          PACKAGES: packages.filter(p => inRange && visitKey(p)===visitKey(visit) && (!filter.patientId || p.PATIENTID===filter.patientId)) };
      });
    }, sql.ISOLATION_LEVEL.SNAPSHOT));
  }

  private async relevant(keys: VisitKey[], session: Session, requiredVersion: string): Promise<VisitKey[]> {
    if (!keys.length) return [];
    const matching = await this.shared(`scope:${requiredVersion}:${JSON.stringify(session.filter)}:${keys.map(visitKey).sort().join(',')}`,250,async()=>{
    const request = this.db.createRequest();
    request.input('keys',sql.NVarChar(sql.MAX),JSON.stringify(keys)); this.bindFilter(request,session.filter);
    const result = await request.query<{ VISITDATETIME: Date; VISITNUMBER: string }>(`
      SELECT k.VISITDATETIME,k.VISITNUMBER FROM OPENJSON(@keys) WITH (VISITDATETIME date,VISITNUMBER varchar(20)) k
      WHERE (@visitNumber IS NULL OR k.VISITNUMBER=@visitNumber) AND (
        EXISTS (SELECT 1 FROM dbo.TBLORX o WHERE o.VISITDATETIME=k.VISITDATETIME AND o.VISITNUMBER=k.VISITNUMBER
          AND (@patientId IS NULL OR o.PATIENTID=@patientId)
          AND (@fromDate IS NULL OR (o.CREATEDATETIME>=@fromDate AND o.CREATEDATETIME<DATEADD(DAY,1,@toDate))))
        OR EXISTS (SELECT 1 FROM dbo.TBLWORKFLOWMASTER w WHERE w.VISITDATETIME=k.VISITDATETIME AND w.VISITNUMBER=k.VISITNUMBER
          AND (@patientId IS NULL OR w.PATIENTID=@patientId)
          AND (@fromDate IS NULL OR (w.VISITDATETIME>=@fromDate AND w.VISITDATETIME<=@toDate))))
    `);
    return new Set(result.recordset.map(row => `${row.VISITDATETIME.toISOString().slice(0,10)}|${row.VISITNUMBER}`));
    });
    return keys.filter(k => matching.has(visitKey(k)) || session.known.has(visitKey(k)));
  }

  private async locks(ids: string[], requiredVersion: string, session: Session): Promise<LockPatch[]> {
    if (!ids.length) return [];
    const rows = await this.shared(`locks:${requiredVersion}:${ids.slice().sort().join(',')}`,250,()=>this.db.withTransaction(async createRequest => {
      const version = await this.tracker.version(createRequest);
      const request=createRequest(); request.input('ids',sql.NVarChar(sql.MAX),JSON.stringify(ids));
      const result=await request.query<{ VISITDATETIME:Date; VISITNUMBER:string; PATIENTID:string; WORKFLOW_ID:string; SESSION_ID:string|null; OWNER_NAME:string|null; WORKSTATION_CODE:string|null; LOCKED_AT:Date|null; EXPIRES_AT:Date|null; IS_LOCKED:boolean }>(`
        SELECT VISITDATETIME,VISITNUMBER,PATIENTID,CONVERT(varchar(36),WORKFLOW_ID) WORKFLOW_ID, VERIFY_LOCK_SESSION SESSION_ID, VERIFY_LOCK_OWNER OWNER_NAME,
          VERIFY_LOCK_WORKSTATION WORKSTATION_CODE, VERIFY_LOCKED_AT LOCKED_AT, VERIFY_LOCK_EXPIRES_AT EXPIRES_AT,
          CONVERT(bit,CASE WHEN VERIFY_LOCK_TOKEN IS NOT NULL AND VERIFY_LOCK_EXPIRES_AT>SYSUTCDATETIME() THEN 1 ELSE 0 END) IS_LOCKED
        FROM dbo.TBLWORKFLOWMASTER WHERE WORKFLOW_ID IN (SELECT CONVERT(uniqueidentifier,value) FROM OPENJSON(@ids));
      `);
      return result.recordset.map(row=>({VISITDATETIME:row.VISITDATETIME.toISOString().slice(0,10),VISITNUMBER:row.VISITNUMBER,PATIENTID:row.PATIENTID,WORKFLOW_ID:row.WORKFLOW_ID,REVISION:version,VERIFY_LOCK:{
        LOCK_TOKEN:null,SESSION_ID:row.SESSION_ID,OWNER_NAME:row.OWNER_NAME,WORKSTATION_CODE:row.WORKSTATION_CODE,
        LOCKED_AT:row.LOCKED_AT?.toISOString()??null,EXPIRES_AT:row.EXPIRES_AT?.toISOString()??null,IS_LOCKED:row.IS_LOCKED,
      }}));
    },sql.ISOLATION_LEVEL.SNAPSHOT));
    return rows.filter(row=>session.known.has(visitKey(row)) && (!session.filter.patientId || row.PATIENTID===session.filter.patientId))
      .map(({WORKFLOW_ID,REVISION,VERIFY_LOCK})=>({WORKFLOW_ID,REVISION,VERIFY_LOCK}));
  }

  private bindFilter(request: sql.Request, f: SyncFilter) {
    request.input('fromDate',sql.Date,f.fromDate??null); request.input('toDate',sql.Date,f.toDate??null);
    request.input('patientId',sql.VarChar(15),f.patientId??null); request.input('visitNumber',sql.VarChar(10),f.visitNumber??null);
  }
  private validate(f: SyncFilter) {
    if (Boolean(f.fromDate)!==Boolean(f.toDate) || (f.fromDate && f.toDate && f.fromDate>f.toDate)
      || (!f.fromDate && !f.patientId && !f.visitNumber)) throw new BadRequestException('Provide a valid complete date range, patientId, or visitNumber');
  }
  private session(id:string) {
    const session=this.sessions.get(id);
    if (!session || session.expires<Date.now()) return this.resync();
    session.expires=Date.now()+TTL; return session;
  }
  private encode(value:Cursor) {
    const data=Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${data}.${createHmac('sha256',this.secret).update(data).digest('base64url')}`;
  }
  private decode(token:string):Cursor {
    try {
      const [data,signature]=token.split('.'); const expected=createHmac('sha256',this.secret).update(data).digest();
      const received=Buffer.from(signature,'base64url');
      if (received.length!==expected.length || !timingSafeEqual(received,expected)) return this.resync();
      const value=JSON.parse(Buffer.from(data,'base64url').toString()) as Cursor;
      if (!/^\d+$/.test(value.s) || !/^\d+$/.test(value.w)) return this.resync();
      return value;
    } catch { return this.resync(); }
  }
  private resync():never { throw new ConflictException({ code:'RESYNC_REQUIRED',message:'Sync cursor expired or dataset changed; start a new snapshot.' }); }
  private async shared<T>(key:string,ttl:number,work:()=>Promise<T>):Promise<T> {
    const cached=this.cache.get(key); if(cached && cached.expires>Date.now()) return cached.promise as Promise<T>;
    const promise=work(); this.cache.set(key,{expires:Number.POSITIVE_INFINITY,promise});
    try { const result=await promise; this.cache.set(key,{expires:Date.now()+ttl,promise}); return result; }
    catch(error) {this.cache.delete(key);throw error;}
  }
  private clean() {
    const now=Date.now();
    for(const [id,s] of this.sessions) if(s.expires<now) this.sessions.delete(id);
    for(const [id,w] of this.windows) if(w.expires<now) this.windows.delete(id);
    for(const [id,c] of this.cache) if(c.expires<now) this.cache.delete(id);
  }
}
