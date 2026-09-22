-- Read-only deployment checks; all tracked tables and both triggers must be enabled.
SELECT DB_NAME() AS DATABASE_NAME, snapshot_isolation_state_desc FROM sys.databases WHERE database_id=DB_ID();
SELECT retention_period,retention_period_units_desc,is_auto_cleanup_on FROM sys.change_tracking_databases WHERE database_id=DB_ID();
SELECT t.name,ct.is_track_columns_updated_on,CHANGE_TRACKING_MIN_VALID_VERSION(t.object_id) AS MIN_VALID_VERSION
FROM sys.tables t LEFT JOIN sys.change_tracking_tables ct ON ct.object_id=t.object_id
WHERE t.name IN ('TBLORX','TBLORXITEMS','TBLPATIENT','TBLMEDITEMSINFO','TBLDOCTOR','TBLDEPT','TBLWORKFLOWMASTER','TBLPACKAGEPRESCRIPTIONS','TBLPACKAGEMASTER','TBLPACKAGEITEMS','TBLREALTIMEINVALIDATIONS','TBLHOSPITALQUEUESTEP','TBLDISPENSINGCHANNELCLAIMS');
SELECT name,is_disabled FROM sys.triggers WHERE name IN ('TR_TBLALLERGY_Realtime','TR_DrugInteraction_Realtime');
SELECT CHANGE_TRACKING_CURRENT_VERSION() AS CURRENT_VERSION;
IF (SELECT COUNT(*) FROM sys.change_tracking_tables WHERE object_id IN (
 OBJECT_ID('dbo.TBLORX'),OBJECT_ID('dbo.TBLORXITEMS'),OBJECT_ID('dbo.TBLPATIENT'),OBJECT_ID('dbo.TBLMEDITEMSINFO'),
 OBJECT_ID('dbo.TBLDOCTOR'),OBJECT_ID('dbo.TBLDEPT'),OBJECT_ID('dbo.TBLWORKFLOWMASTER'),OBJECT_ID('dbo.TBLPACKAGEPRESCRIPTIONS'),
 OBJECT_ID('dbo.TBLPACKAGEMASTER'),OBJECT_ID('dbo.TBLPACKAGEITEMS'),OBJECT_ID('dbo.TBLREALTIMEINVALIDATIONS'),OBJECT_ID('dbo.TBLHOSPITALQUEUESTEP'),OBJECT_ID('dbo.TBLDISPENSINGCHANNELCLAIMS')) AND is_track_columns_updated_on=1)<>13
 THROW 51000,'Realtime tables or column tracking are not fully enabled.',1;
IF (SELECT COUNT(*) FROM sys.triggers WHERE name IN ('TR_TBLALLERGY_Realtime','TR_DrugInteraction_Realtime') AND is_disabled=0)<>2
 THROW 51000,'Realtime clinical alert triggers are not fully enabled.',1;
IF (SELECT snapshot_isolation_state FROM sys.databases WHERE database_id=DB_ID())<>1
 THROW 51000,'Snapshot isolation is not enabled.',1;
