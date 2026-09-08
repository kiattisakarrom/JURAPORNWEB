-- Install on the intended database. No patient/prescription data is rewritten.
SET XACT_ABORT ON;
IF EXISTS (
 SELECT 1 FROM (VALUES (N'TBLORX'),(N'TBLORXITEMS'),(N'TBLPATIENT'),(N'TBLMEDITEMSINFO'),(N'TBLDOCTOR'),(N'TBLDEPT'),(N'TBLWORKFLOWMASTER'),(N'TBLPACKAGEPRESCRIPTIONS'),(N'TBLPACKAGEMASTER'),(N'TBLPACKAGEITEMS')) required(name)
 WHERE OBJECT_ID(N'dbo.'+required.name,N'U') IS NULL
 OR NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.'+required.name) AND is_primary_key=1)
) THROW 51000, 'Realtime requires all source/workflow tables and their existing primary keys.', 1;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_databases WHERE database_id=DB_ID())
BEGIN
 IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'JurapornRealtimeEnabledCT')
  EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT', @value=1;
 DECLARE @ct nvarchar(max)=N'ALTER DATABASE '+QUOTENAME(DB_NAME())+N' SET CHANGE_TRACKING = ON (CHANGE_RETENTION = 7 DAYS, AUTO_CLEANUP = ON)';
 EXEC sys.sp_executesql @ct;
END;
IF (SELECT snapshot_isolation_state FROM sys.databases WHERE database_id=DB_ID())=0
BEGIN
 IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'JurapornRealtimeEnabledSnapshot')
  EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledSnapshot', @value=1;
 DECLARE @snapshot nvarchar(max)=N'ALTER DATABASE '+QUOTENAME(DB_NAME())+N' SET ALLOW_SNAPSHOT_ISOLATION ON';
 EXEC sys.sp_executesql @snapshot;
END;
GO
IF OBJECT_ID(N'dbo.TBLREALTIMEINVALIDATIONS',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.TBLREALTIMEINVALIDATIONS (
  SCOPE_TYPE varchar(16) NOT NULL,
  SCOPE_KEY nvarchar(100) NOT NULL,
  TOUCHED_AT datetime2(3) NOT NULL CONSTRAINT DF_REALTIME_TOUCHED DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_TBLREALTIMEINVALIDATIONS PRIMARY KEY (SCOPE_TYPE,SCOPE_KEY),
  CONSTRAINT CK_REALTIME_SCOPE CHECK (SCOPE_TYPE IN ('PATIENT','MEDICINE','GLOBAL'))
 );
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeCreated',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLREALTIMEINVALIDATIONS';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLORX'))
BEGIN
 ALTER TABLE dbo.TBLORX ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLORX';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLORXITEMS'))
BEGIN
 ALTER TABLE dbo.TBLORXITEMS ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLORXITEMS';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLPATIENT'))
BEGIN
 ALTER TABLE dbo.TBLPATIENT ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLPATIENT';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLMEDITEMSINFO'))
BEGIN
 ALTER TABLE dbo.TBLMEDITEMSINFO ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLMEDITEMSINFO';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLDOCTOR'))
BEGIN
 ALTER TABLE dbo.TBLDOCTOR ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLDOCTOR';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLDEPT'))
BEGIN
 ALTER TABLE dbo.TBLDEPT ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLDEPT';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLWORKFLOWMASTER'))
BEGIN
 ALTER TABLE dbo.TBLWORKFLOWMASTER ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLWORKFLOWMASTER';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLPACKAGEPRESCRIPTIONS'))
BEGIN
 ALTER TABLE dbo.TBLPACKAGEPRESCRIPTIONS ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLPACKAGEPRESCRIPTIONS';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLPACKAGEMASTER'))
BEGIN
 ALTER TABLE dbo.TBLPACKAGEMASTER ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLPACKAGEMASTER';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLPACKAGEITEMS'))
BEGIN
 ALTER TABLE dbo.TBLPACKAGEITEMS ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLPACKAGEITEMS';
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLREALTIMEINVALIDATIONS'))
BEGIN
 ALTER TABLE dbo.TBLREALTIMEINVALIDATIONS ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
 EXEC sys.sp_addextendedproperty @name=N'JurapornRealtimeEnabledCT',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLREALTIMEINVALIDATIONS';
END;
GO
CREATE OR ALTER TRIGGER dbo.TR_TBLALLERGY_Realtime ON dbo.TBLALLERGY
AFTER INSERT, UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @keys TABLE (code nvarchar(100) NOT NULL PRIMARY KEY);
 INSERT INTO @keys(code)
 SELECT DISTINCT LTRIM(RTRIM(CONVERT(nvarchar(100),code)))
 FROM (SELECT HN AS code FROM inserted UNION SELECT HN FROM deleted) changed
 WHERE NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100),code))),N'') IS NOT NULL;
 -- Range locks make the two-statement upsert safe for concurrent writers.
 UPDATE target WITH (UPDLOCK,SERIALIZABLE)
 SET TOUCHED_AT=SYSUTCDATETIME()
 FROM dbo.TBLREALTIMEINVALIDATIONS target JOIN @keys k ON target.SCOPE_KEY=k.code
 WHERE target.SCOPE_TYPE='PATIENT';
 INSERT INTO dbo.TBLREALTIMEINVALIDATIONS(SCOPE_TYPE,SCOPE_KEY)
 SELECT 'PATIENT',k.code FROM @keys k
 WHERE NOT EXISTS (SELECT 1 FROM dbo.TBLREALTIMEINVALIDATIONS WITH (UPDLOCK,SERIALIZABLE)
  WHERE SCOPE_TYPE='PATIENT' AND SCOPE_KEY=k.code);
END;
GO
CREATE OR ALTER TRIGGER dbo.TR_DrugInteraction_Realtime ON dbo.DrugInteraction
AFTER INSERT, UPDATE, DELETE AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @keys TABLE (code nvarchar(100) NOT NULL PRIMARY KEY);
 INSERT INTO @keys(code)
 SELECT DISTINCT LTRIM(RTRIM(CONVERT(nvarchar(100),code)))
 FROM (SELECT StockCode AS code FROM inserted UNION SELECT WithStockCode FROM inserted UNION SELECT StockCode FROM deleted UNION SELECT WithStockCode FROM deleted) changed
 WHERE NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(100),code))),N'') IS NOT NULL;
 -- Range locks make the two-statement upsert safe for concurrent writers.
 UPDATE target WITH (UPDLOCK,SERIALIZABLE)
 SET TOUCHED_AT=SYSUTCDATETIME()
 FROM dbo.TBLREALTIMEINVALIDATIONS target JOIN @keys k ON target.SCOPE_KEY=k.code
 WHERE target.SCOPE_TYPE='MEDICINE';
 INSERT INTO dbo.TBLREALTIMEINVALIDATIONS(SCOPE_TYPE,SCOPE_KEY)
 SELECT 'MEDICINE',k.code FROM @keys k
 WHERE NOT EXISTS (SELECT 1 FROM dbo.TBLREALTIMEINVALIDATIONS WITH (UPDLOCK,SERIALIZABLE)
  WHERE SCOPE_TYPE='MEDICINE' AND SCOPE_KEY=k.code);
END;
GO
