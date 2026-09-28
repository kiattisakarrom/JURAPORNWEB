SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.TBLPACKAGEITEMS', N'U') IS NULL
  THROW 51000, 'dbo.TBLPACKAGEITEMS is required before installing drug label templates.', 1;
GO

IF OBJECT_ID(N'dbo.TBLDRUGLABELTEMPLATES', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TBLDRUGLABELTEMPLATES (
    TEMPLATE_ID uniqueidentifier NOT NULL CONSTRAINT DF_TBLDRUGLABELTEMPLATES_ID DEFAULT NEWSEQUENTIALID(),
    TEMPLATE_NAME nvarchar(120) NOT NULL,
    VERSION_NO int NOT NULL,
    TEMPLATE_STATUS varchar(16) NOT NULL,
    WIDTH_MM decimal(8,2) NOT NULL,
    HEIGHT_MM decimal(8,2) NOT NULL,
    DEFINITION_JSON nvarchar(max) NOT NULL,
    LOGO_MIME_TYPE varchar(40) NULL,
    LOGO_DATA varbinary(max) NULL,
    UPDATED_BY nvarchar(150) NULL,
    CREATED_AT datetime2(3) NOT NULL CONSTRAINT DF_TBLDRUGLABELTEMPLATES_CREATED DEFAULT SYSUTCDATETIME(),
    UPDATED_AT datetime2(3) NOT NULL CONSTRAINT DF_TBLDRUGLABELTEMPLATES_UPDATED DEFAULT SYSUTCDATETIME(),
    PUBLISHED_AT datetime2(3) NULL,
    ROW_VERSION rowversion NOT NULL,
    CONSTRAINT PK_TBLDRUGLABELTEMPLATES PRIMARY KEY (TEMPLATE_ID),
    CONSTRAINT CK_TBLDRUGLABELTEMPLATES_STATUS CHECK (TEMPLATE_STATUS IN ('DRAFT','ACTIVE','ARCHIVED')),
    CONSTRAINT CK_TBLDRUGLABELTEMPLATES_SIZE CHECK (WIDTH_MM BETWEEN 25.4 AND 304.8 AND HEIGHT_MM BETWEEN 25.4 AND 304.8),
    CONSTRAINT CK_TBLDRUGLABELTEMPLATES_JSON CHECK (ISJSON(DEFINITION_JSON) = 1)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.TBLDRUGLABELTEMPLATES') AND name=N'UX_TBLDRUGLABELTEMPLATES_ACTIVE')
  CREATE UNIQUE INDEX UX_TBLDRUGLABELTEMPLATES_ACTIVE ON dbo.TBLDRUGLABELTEMPLATES(TEMPLATE_STATUS) WHERE TEMPLATE_STATUS='ACTIVE';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.TBLDRUGLABELTEMPLATES') AND name=N'UX_TBLDRUGLABELTEMPLATES_DRAFT')
  CREATE UNIQUE INDEX UX_TBLDRUGLABELTEMPLATES_DRAFT ON dbo.TBLDRUGLABELTEMPLATES(TEMPLATE_STATUS) WHERE TEMPLATE_STATUS='DRAFT';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.TBLDRUGLABELTEMPLATES') AND name=N'IX_TBLDRUGLABELTEMPLATES_VERSION')
  CREATE INDEX IX_TBLDRUGLABELTEMPLATES_VERSION ON dbo.TBLDRUGLABELTEMPLATES(VERSION_NO DESC, CREATED_AT DESC);
GO

IF COL_LENGTH(N'dbo.TBLPACKAGEITEMS', N'LABEL_TEMPLATE_ID') IS NULL
  ALTER TABLE dbo.TBLPACKAGEITEMS ADD LABEL_TEMPLATE_ID uniqueidentifier NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id=OBJECT_ID(N'dbo.TBLPACKAGEITEMS')
    AND name=N'FK_TBLPACKAGEITEMS_LABEL_TEMPLATE'
)
  ALTER TABLE dbo.TBLPACKAGEITEMS WITH CHECK
    ADD CONSTRAINT FK_TBLPACKAGEITEMS_LABEL_TEMPLATE FOREIGN KEY (LABEL_TEMPLATE_ID)
    REFERENCES dbo.TBLDRUGLABELTEMPLATES(TEMPLATE_ID);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.TBLPACKAGEITEMS') AND name=N'IX_TBLPACKAGEITEMS_LABEL_TEMPLATE')
  CREATE INDEX IX_TBLPACKAGEITEMS_LABEL_TEMPLATE ON dbo.TBLPACKAGEITEMS(LABEL_TEMPLATE_ID) WHERE LABEL_TEMPLATE_ID IS NOT NULL;
GO

DECLARE @DefaultDefinition nvarchar(max) = N'{
  "schemaVersion": 1,
  "elements": [
    {"id":"border","type":"box","xMm":1.5,"yMm":1.5,"widthMm":98.6,"heightMm":73.2,"zIndex":1,"borderColor":"#244487","borderWidth":0.5,"borderRadiusMm":3,"backgroundColor":"transparent"},
    {"id":"logo","type":"logo","xMm":5,"yMm":4,"widthMm":8,"heightMm":14,"zIndex":3,"fit":"contain","imageSrc":"/assets/juraporn-hospital-emblem.png"},
    {"id":"hospital_name","type":"text","text":"โรงพยาบาลจุฬาภรณ์","xMm":14,"yMm":6,"widthMm":24,"heightMm":5,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":8,"fontWeight":600,"textAlign":"left","color":"#244487"},
    {"id":"hospital_phone","type":"text","text":"Tel. 02 576 6000 หรือ 1118","xMm":14,"yMm":12,"widthMm":25,"heightMm":4,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":7,"fontWeight":500,"textAlign":"left","color":"#244487"},
    {"id":"patient_name","type":"field","dataKey":"patientName","xMm":40,"yMm":5,"widthMm":28,"heightMm":7,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":14,"fontWeight":700,"textAlign":"left","color":"#111827"},
    {"id":"visit_date","type":"field","dataKey":"visitDateTime","xMm":68,"yMm":5,"widthMm":24,"heightMm":6,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":9,"fontWeight":600,"textAlign":"right","color":"#111827"},
    {"id":"item_counter","type":"field","dataKey":"itemCounter","xMm":91,"yMm":3,"widthMm":7,"heightMm":5,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":10,"fontWeight":700,"textAlign":"right","color":"#111827"},
    {"id":"hn","type":"field","dataKey":"patientHn","prefix":"HN : ","xMm":40,"yMm":12,"widthMm":22,"heightMm":5,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":9,"fontWeight":600,"textAlign":"left","color":"#111827"},
    {"id":"vn","type":"field","dataKey":"visitVn","prefix":"VN : ","xMm":61,"yMm":12,"widthMm":17,"heightMm":5,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":9,"fontWeight":600,"textAlign":"left","color":"#111827"},
    {"id":"doctor","type":"field","dataKey":"doctorName","xMm":78,"yMm":12,"widthMm":20,"heightMm":5,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":9,"fontWeight":600,"textAlign":"right","color":"#111827"},
    {"id":"separator","type":"line","xMm":2,"yMm":20,"widthMm":97.6,"heightMm":0.4,"zIndex":2,"borderColor":"#111827","borderWidth":0.4,"lineStyle":"dashed"},
    {"id":"medicine","type":"field","dataKey":"medicineName","xMm":5,"yMm":24,"widthMm":70,"heightMm":8,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":16,"fontWeight":700,"textAlign":"left","color":"#111827"},
    {"id":"quantity","type":"field","dataKey":"quantity","prefix":"#","xMm":76,"yMm":24,"widthMm":20,"heightMm":7,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":13,"fontWeight":700,"textAlign":"right","color":"#111827"},
    {"id":"medicine_pronunciation","type":"field","dataKey":"medicinePronunciation","prefix":"[ ","suffix":" ]","xMm":8,"yMm":31,"widthMm":58,"heightMm":6,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":10,"fontWeight":600,"textAlign":"left","color":"#111827"},
    {"id":"dose","type":"field","dataKey":"doseMemo","xMm":5,"yMm":38,"widthMm":68,"heightMm":15,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":12,"fontWeight":500,"textAlign":"left","color":"#111827"},
    {"id":"indication","type":"field","dataKey":"indication","xMm":5,"yMm":52,"widthMm":65,"heightMm":6,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":12,"fontWeight":700,"textAlign":"left","color":"#111827"},
    {"id":"qr","type":"qr","dataKey":"qrToken","xMm":78,"yMm":32,"widthMm":15,"heightMm":15,"zIndex":3,"backgroundColor":"#ffffff"},
    {"id":"qr_caption","type":"text","text":"QR code ข้อมูลยา","xMm":76,"yMm":47,"widthMm":20,"heightMm":4,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":7,"fontWeight":500,"textAlign":"center","color":"#111827"},
    {"id":"expiry","type":"field","dataKey":"expiryDate","prefix":"วันหมดอายุ : ","xMm":70,"yMm":55,"widthMm":27,"heightMm":5,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":8,"fontWeight":500,"textAlign":"right","color":"#111827"},
    {"id":"footer_box","type":"box","xMm":1.5,"yMm":61,"widthMm":98.6,"heightMm":14.7,"zIndex":2,"borderColor":"#244487","borderWidth":0,"borderRadiusMm":3,"backgroundColor":"#244487"},
    {"id":"footer_instruction","type":"text","text":"ควรรับประทานยาตามแพทย์สั่งทุกวัน\n** โปรดแจ้งแพทย์หากเกิดอาการไอต่อเนื่องหลังใช้ยา**","xMm":22,"yMm":64,"widthMm":55,"heightMm":9,"zIndex":4,"fontFamily":"Sarabun","fontSizePt":9,"fontWeight":500,"textAlign":"center","color":"#ffffff"},
    {"id":"storage","type":"field","dataKey":"storageInstruction","xMm":78,"yMm":63,"widthMm":18,"heightMm":9,"zIndex":4,"fontFamily":"Sarabun","fontSizePt":9,"fontWeight":500,"textAlign":"center","color":"#ffffff","borderColor":"#ffffff","borderWidth":0.4}
  ]
}';

IF NOT EXISTS (SELECT 1 FROM dbo.TBLDRUGLABELTEMPLATES WHERE TEMPLATE_STATUS='ACTIVE')
  INSERT INTO dbo.TBLDRUGLABELTEMPLATES(TEMPLATE_NAME,VERSION_NO,TEMPLATE_STATUS,WIDTH_MM,HEIGHT_MM,DEFINITION_JSON,UPDATED_BY,PUBLISHED_AT)
  VALUES(N'ฉลากยามาตรฐาน 4x3 นิ้ว',1,'ACTIVE',101.60,76.20,@DefaultDefinition,N'System seed',SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.TBLDRUGLABELTEMPLATES WHERE TEMPLATE_STATUS='DRAFT')
  INSERT INTO dbo.TBLDRUGLABELTEMPLATES(TEMPLATE_NAME,VERSION_NO,TEMPLATE_STATUS,WIDTH_MM,HEIGHT_MM,DEFINITION_JSON,UPDATED_BY)
  SELECT TOP (1) TEMPLATE_NAME,VERSION_NO,'DRAFT',WIDTH_MM,HEIGHT_MM,DEFINITION_JSON,N'System seed'
  FROM dbo.TBLDRUGLABELTEMPLATES WHERE TEMPLATE_STATUS='ACTIVE' ORDER BY VERSION_NO DESC;
GO

/*
  Upgrade templates created by an older revision of migration 010 where the
  hospital name and telephone number were embedded in the logo image. This
  block is intentionally part of 010 so the same file works for both a fresh
  install and an existing database when it is run again.
*/
BEGIN TRANSACTION;

DECLARE
  @UpgradeTemplateId uniqueidentifier,
  @UpgradeTemplateName nvarchar(120),
  @UpgradeVersionNo int,
  @UpgradeTemplateStatus varchar(16),
  @UpgradeWidthMm decimal(8,2),
  @UpgradeHeightMm decimal(8,2),
  @UpgradeDefinition nvarchar(max),
  @UpgradeLogoMimeType varchar(40),
  @UpgradeLogoData varbinary(max),
  @UpgradeLogoIndex int,
  @UpgradeLogoPath nvarchar(100),
  @UpgradeNextVersion int;

DECLARE drug_label_header_cursor CURSOR LOCAL FAST_FORWARD FOR
  SELECT TEMPLATE_ID,TEMPLATE_NAME,VERSION_NO,TEMPLATE_STATUS,WIDTH_MM,HEIGHT_MM,
    DEFINITION_JSON,LOGO_MIME_TYPE,LOGO_DATA
  FROM dbo.TBLDRUGLABELTEMPLATES
  WHERE TEMPLATE_STATUS IN ('ACTIVE','DRAFT')
    AND EXISTS (
      SELECT 1 FROM OPENJSON(DEFINITION_JSON,'$.elements')
      WHERE JSON_VALUE(value,'$.id')='logo'
    )
    AND NOT EXISTS (
      SELECT 1 FROM OPENJSON(DEFINITION_JSON,'$.elements')
      WHERE JSON_VALUE(value,'$.id')='hospital_name'
    );

OPEN drug_label_header_cursor;
FETCH NEXT FROM drug_label_header_cursor INTO
  @UpgradeTemplateId,@UpgradeTemplateName,@UpgradeVersionNo,@UpgradeTemplateStatus,
  @UpgradeWidthMm,@UpgradeHeightMm,@UpgradeDefinition,@UpgradeLogoMimeType,@UpgradeLogoData;

WHILE @@FETCH_STATUS = 0
BEGIN
  SET @UpgradeLogoIndex = NULL;
  SELECT TOP (1) @UpgradeLogoIndex=TRY_CONVERT(int,[key])
  FROM OPENJSON(@UpgradeDefinition,'$.elements')
  WHERE JSON_VALUE(value,'$.id')='logo';

  IF @UpgradeLogoIndex IS NOT NULL
  BEGIN
    SET @UpgradeLogoPath = CONCAT('$.elements[',@UpgradeLogoIndex,']');
    SET @UpgradeDefinition = JSON_MODIFY(@UpgradeDefinition,CONCAT(@UpgradeLogoPath,'.xMm'),CONVERT(decimal(8,2),5));
    SET @UpgradeDefinition = JSON_MODIFY(@UpgradeDefinition,CONCAT(@UpgradeLogoPath,'.yMm'),CONVERT(decimal(8,2),4));
    SET @UpgradeDefinition = JSON_MODIFY(@UpgradeDefinition,CONCAT(@UpgradeLogoPath,'.widthMm'),CONVERT(decimal(8,2),8));
    SET @UpgradeDefinition = JSON_MODIFY(@UpgradeDefinition,CONCAT(@UpgradeLogoPath,'.heightMm'),CONVERT(decimal(8,2),14));
    SET @UpgradeDefinition = JSON_MODIFY(@UpgradeDefinition,CONCAT(@UpgradeLogoPath,'.imageSrc'),N'/assets/juraporn-hospital-emblem.png');
    SET @UpgradeDefinition = JSON_MODIFY(@UpgradeDefinition,'append $.elements',JSON_QUERY(N'{"id":"hospital_name","type":"text","text":"โรงพยาบาลจุฬาภรณ์","xMm":14,"yMm":6,"widthMm":24,"heightMm":5,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":8,"fontWeight":600,"textAlign":"left","color":"#244487"}'));
    SET @UpgradeDefinition = JSON_MODIFY(@UpgradeDefinition,'append $.elements',JSON_QUERY(N'{"id":"hospital_phone","type":"text","text":"Tel. 02 576 6000 หรือ 1118","xMm":14,"yMm":12,"widthMm":25,"heightMm":4,"zIndex":3,"fontFamily":"Sarabun","fontSizePt":7,"fontWeight":500,"textAlign":"left","color":"#244487"}'));

    IF @UpgradeTemplateStatus='ACTIVE' AND EXISTS (
      SELECT 1 FROM dbo.TBLPACKAGEITEMS WHERE LABEL_TEMPLATE_ID=@UpgradeTemplateId
    )
    BEGIN
      SELECT @UpgradeNextVersion=ISNULL(MAX(VERSION_NO),0)+1
      FROM dbo.TBLDRUGLABELTEMPLATES WITH (UPDLOCK,HOLDLOCK);

      UPDATE dbo.TBLDRUGLABELTEMPLATES
      SET TEMPLATE_STATUS='ARCHIVED',UPDATED_AT=SYSUTCDATETIME()
      WHERE TEMPLATE_ID=@UpgradeTemplateId;

      INSERT INTO dbo.TBLDRUGLABELTEMPLATES(
        TEMPLATE_NAME,VERSION_NO,TEMPLATE_STATUS,WIDTH_MM,HEIGHT_MM,DEFINITION_JSON,
        LOGO_MIME_TYPE,LOGO_DATA,UPDATED_BY,PUBLISHED_AT
      ) VALUES (
        @UpgradeTemplateName,@UpgradeNextVersion,'ACTIVE',@UpgradeWidthMm,@UpgradeHeightMm,
        @UpgradeDefinition,@UpgradeLogoMimeType,@UpgradeLogoData,N'System migration 010',SYSUTCDATETIME()
      );
    END
    ELSE
    BEGIN
      UPDATE dbo.TBLDRUGLABELTEMPLATES
      SET DEFINITION_JSON=@UpgradeDefinition,UPDATED_BY=N'System migration 010',UPDATED_AT=SYSUTCDATETIME()
      WHERE TEMPLATE_ID=@UpgradeTemplateId;
    END
  END

  FETCH NEXT FROM drug_label_header_cursor INTO
    @UpgradeTemplateId,@UpgradeTemplateName,@UpgradeVersionNo,@UpgradeTemplateStatus,
    @UpgradeWidthMm,@UpgradeHeightMm,@UpgradeDefinition,@UpgradeLogoMimeType,@UpgradeLogoData;
END

CLOSE drug_label_header_cursor;
DEALLOCATE drug_label_header_cursor;

COMMIT TRANSACTION;
GO

IF OBJECT_ID(N'dbo.TBLDRUGLABELTEMPLATES', N'U') IS NULL
  THROW 51000, 'dbo.TBLDRUGLABELTEMPLATES was not created.', 1;
IF COL_LENGTH(N'dbo.TBLPACKAGEITEMS', N'LABEL_TEMPLATE_ID') IS NULL
  THROW 51000, 'dbo.TBLPACKAGEITEMS.LABEL_TEMPLATE_ID was not created.', 1;
IF (SELECT COUNT(*) FROM dbo.TBLDRUGLABELTEMPLATES WHERE TEMPLATE_STATUS='ACTIVE') <> 1
  THROW 51000, 'Exactly one ACTIVE drug label template is required.', 1;
IF (SELECT COUNT(*) FROM dbo.TBLDRUGLABELTEMPLATES WHERE TEMPLATE_STATUS='DRAFT') <> 1
  THROW 51000, 'Exactly one DRAFT drug label template is required.', 1;
IF EXISTS (
  SELECT 1
  FROM dbo.TBLDRUGLABELTEMPLATES
  WHERE TEMPLATE_STATUS IN ('ACTIVE','DRAFT')
    AND NOT EXISTS (
      SELECT 1 FROM OPENJSON(DEFINITION_JSON,'$.elements')
      WHERE JSON_VALUE(value,'$.id')='hospital_name'
    )
)
  THROW 51000, 'The hospital-name text element was not installed.', 1;
GO

SELECT TEMPLATE_ID,TEMPLATE_NAME,VERSION_NO,TEMPLATE_STATUS,WIDTH_MM,HEIGHT_MM,UPDATED_AT,PUBLISHED_AT
FROM dbo.TBLDRUGLABELTEMPLATES ORDER BY TEMPLATE_STATUS,VERSION_NO DESC;
GO
