-- Stop Backend realtime first. Removes only objects/settings marked as installed by 005.
-- Never deletes source, workflow, package, or patient records.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DROP TRIGGER IF EXISTS dbo.TR_TBLALLERGY_Realtime;
DROP TRIGGER IF EXISTS dbo.TR_DrugInteraction_Realtime;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLORX') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLORX'))
  ALTER TABLE dbo.TBLORX DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLORX';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLORXITEMS') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLORXITEMS'))
  ALTER TABLE dbo.TBLORXITEMS DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLORXITEMS';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLPATIENT') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLPATIENT'))
  ALTER TABLE dbo.TBLPATIENT DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLPATIENT';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLMEDITEMSINFO') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLMEDITEMSINFO'))
  ALTER TABLE dbo.TBLMEDITEMSINFO DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLMEDITEMSINFO';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLDOCTOR') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLDOCTOR'))
  ALTER TABLE dbo.TBLDOCTOR DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLDOCTOR';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLDEPT') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLDEPT'))
  ALTER TABLE dbo.TBLDEPT DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLDEPT';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLWORKFLOWMASTER') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLWORKFLOWMASTER'))
  ALTER TABLE dbo.TBLWORKFLOWMASTER DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLWORKFLOWMASTER';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLPACKAGEPRESCRIPTIONS') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLPACKAGEPRESCRIPTIONS'))
  ALTER TABLE dbo.TBLPACKAGEPRESCRIPTIONS DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLPACKAGEPRESCRIPTIONS';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLPACKAGEMASTER') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLPACKAGEMASTER'))
  ALTER TABLE dbo.TBLPACKAGEMASTER DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLPACKAGEMASTER';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLPACKAGEITEMS') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLPACKAGEITEMS'))
  ALTER TABLE dbo.TBLPACKAGEITEMS DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLPACKAGEITEMS';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLREALTIMEINVALIDATIONS') AND name=N'JurapornRealtimeEnabledCT')
BEGIN
 IF EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID(N'dbo.TBLREALTIMEINVALIDATIONS'))
  ALTER TABLE dbo.TBLREALTIMEINVALIDATIONS DISABLE CHANGE_TRACKING;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'TBLREALTIMEINVALIDATIONS';
END;
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.TBLREALTIMEINVALIDATIONS') AND name=N'JurapornRealtimeCreated')
 DROP TABLE dbo.TBLREALTIMEINVALIDATIONS;
COMMIT;
GO
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'JurapornRealtimeEnabledCT')
 AND NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables)
BEGIN
 DECLARE @ct nvarchar(max)=N'ALTER DATABASE '+QUOTENAME(DB_NAME())+N' SET CHANGE_TRACKING = OFF';
 EXEC sys.sp_executesql @ct;
 EXEC sys.sp_dropextendedproperty @name=N'JurapornRealtimeEnabledCT';
END;
-- ALLOW_SNAPSHOT_ISOLATION is deliberately retained: other applications may now
-- depend on it. A DBA may turn it OFF after checking active snapshot users.
GO

