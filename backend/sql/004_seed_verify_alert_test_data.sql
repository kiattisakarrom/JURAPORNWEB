SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Today date = CONVERT(date, SYSDATETIME());
DECLARE @Now datetime2(3) = SYSDATETIME();

DECLARE @Patients TABLE (
  PATIENTID varchar(15) NOT NULL PRIMARY KEY,
  FULLNAME_TH varchar(350) NOT NULL,
  FIRSTNAME_TH varchar(150) NOT NULL,
  LASTNAME_TH varchar(150) NOT NULL
);

INSERT INTO @Patients (PATIENTID, FULLNAME_TH, FIRSTNAME_TH, LASTNAME_TH)
VALUES
  ('TESTAI000001',   'TEST - Allergy Alert',          'TEST', 'Allergy Alert'),
  ('TESTDI000001',   'TEST - Drug Interaction',       'TEST', 'Drug Interaction'),
  ('TESTAIDI00001',  'TEST - Allergy and Interaction','TEST', 'Allergy and Interaction');

DECLARE @Medicines TABLE (
  MEDICINECODE varchar(30) NOT NULL PRIMARY KEY,
  COMMERCIALNAME varchar(255) NOT NULL,
  GENERICNAME varchar(255) NOT NULL,
  STRENGTH varchar(50) NOT NULL,
  UNITSTH nvarchar(60) NOT NULL
);

INSERT INTO @Medicines (MEDICINECODE, COMMERCIALNAME, GENERICNAME, STRENGTH, UNITSTH)
VALUES
  ('1499900001', 'TEST Amoxicillin 500 mg',    'Amoxicillin',    '500 mg', N'เม็ด'),
  ('1499900011', 'TEST Warfarin 3 mg',         'Warfarin',       '3 mg',   N'เม็ด'),
  ('1499900012', 'TEST Aspirin 81 mg',         'Aspirin',        '81 mg',  N'เม็ด'),
  ('1499900021', 'TEST Simvastatin 20 mg',     'Simvastatin',    '20 mg',  N'เม็ด'),
  ('1499900022', 'TEST Clarithromycin 500 mg', 'Clarithromycin', '500 mg', N'เม็ด');

DECLARE @Prescriptions TABLE (
  VISITNUMBER varchar(10) NOT NULL,
  PRESCRIPTIONNUMBER varchar(16) NOT NULL,
  PATIENTID varchar(15) NOT NULL,
  CREATEDATETIME datetime2(3) NOT NULL,
  PRIMARY KEY (VISITNUMBER, PRESCRIPTIONNUMBER)
);

INSERT INTO @Prescriptions (VISITNUMBER, PRESCRIPTIONNUMBER, PATIENTID, CREATEDATETIME)
VALUES
  ('TSAI000001', '01', 'TESTAI000001',  DATEADD(SECOND, -30, @Now)),
  ('TSDI000001', '01', 'TESTDI000001',  DATEADD(SECOND, -20, @Now)),
  ('TSDI000001', '02', 'TESTDI000001',  DATEADD(SECOND, -19, @Now)),
  ('TSAD000001', '01', 'TESTAIDI00001', DATEADD(SECOND, -10, @Now));

DECLARE @Items TABLE (
  VISITNUMBER varchar(10) NOT NULL,
  PRESCRIPTIONNUMBER varchar(16) NOT NULL,
  PATIENTID varchar(15) NOT NULL,
  ITEMSEQ int NOT NULL,
  MEDICINECODE varchar(30) NOT NULL,
  ORDERQTY decimal(18,2) NOT NULL,
  ORDERUNITCODE varchar(32) NOT NULL,
  DOSEMEMO_TH varchar(max) NOT NULL,
  PRIMARY KEY (VISITNUMBER, PRESCRIPTIONNUMBER, MEDICINECODE, ITEMSEQ)
);

INSERT INTO @Items (
  VISITNUMBER, PRESCRIPTIONNUMBER, PATIENTID, ITEMSEQ,
  MEDICINECODE, ORDERQTY, ORDERUNITCODE, DOSEMEMO_TH
)
VALUES
  ('TSAI000001', '01', 'TESTAI000001',  1, '1499900001', 20, 'TAB', N'รับประทานครั้งละ 1 เม็ด วันละ 2 ครั้ง หลังอาหารเช้าและเย็น'),
  ('TSDI000001', '01', 'TESTDI000001',  1, '1499900011', 30, 'TAB', N'รับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง เวลาเย็น'),
  ('TSDI000001', '02', 'TESTDI000001',  1, '1499900012', 30, 'TAB', N'รับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง หลังอาหารเช้า'),
  ('TSAD000001', '01', 'TESTAIDI00001', 1, '1499900021', 30, 'TAB', N'รับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง ก่อนนอน'),
  ('TSAD000001', '01', 'TESTAIDI00001', 2, '1499900022', 14, 'TAB', N'รับประทานครั้งละ 1 เม็ด วันละ 2 ครั้ง หลังอาหารเช้าและเย็น รับประทานติดต่อกันจนหมด');

BEGIN TRY
  BEGIN TRANSACTION;

  IF EXISTS (
    SELECT 1
    FROM dbo.TBLPATIENT AS patient
    JOIN @Patients AS seed ON seed.PATIENTID = patient.PATIENTID
    WHERE ISNULL(patient.FULLNAME_TH, '') NOT LIKE 'TEST - %'
  )
    THROW 51000, 'Reserved test PATIENTID is already used by non-test data.', 1;

  IF EXISTS (
    SELECT 1
    FROM dbo.TBLMEDITEMSINFO AS medicine
    JOIN @Medicines AS seed ON seed.MEDICINECODE = medicine.MEDICINECODE
    WHERE ISNULL(medicine.COMMERCIALNAME, '') NOT LIKE 'TEST %'
  )
    THROW 51000, 'Reserved test MEDICINECODE is already used by non-test data.', 1;

  IF OBJECT_ID(N'dbo.TBLWORKFLOWMASTER', N'U') IS NOT NULL
  BEGIN
    DECLARE @WorkflowIds TABLE (WORKFLOW_ID uniqueidentifier NOT NULL PRIMARY KEY);

    INSERT INTO @WorkflowIds (WORKFLOW_ID)
    SELECT workflow.WORKFLOW_ID
    FROM dbo.TBLWORKFLOWMASTER AS workflow
    WHERE workflow.VISITDATETIME = @Today
      AND workflow.VISITNUMBER IN ('TSAI000001', 'TSDI000001', 'TSAD000001');

    DELETE event
    FROM dbo.TBLPACKAGEEVENTS AS event
    JOIN @WorkflowIds AS target ON target.WORKFLOW_ID = event.WORKFLOW_ID;

    DELETE item
    FROM dbo.TBLPACKAGEITEMS AS item
    JOIN @WorkflowIds AS target ON target.WORKFLOW_ID = item.WORKFLOW_ID;

    DELETE package
    FROM dbo.TBLPACKAGEMASTER AS package
    JOIN @WorkflowIds AS target ON target.WORKFLOW_ID = package.WORKFLOW_ID;

    DELETE prescription
    FROM dbo.TBLPACKAGEPRESCRIPTIONS AS prescription
    JOIN @WorkflowIds AS target ON target.WORKFLOW_ID = prescription.WORKFLOW_ID;

    DELETE workflow
    FROM dbo.TBLWORKFLOWMASTER AS workflow
    JOIN @WorkflowIds AS target ON target.WORKFLOW_ID = workflow.WORKFLOW_ID;
  END;

  DELETE item
  FROM dbo.TBLORXITEMS AS item
  WHERE item.VISITDATETIME = @Today
    AND item.VISITNUMBER IN ('TSAI000001', 'TSDI000001', 'TSAD000001');

  DELETE prescription
  FROM dbo.TBLORX AS prescription
  WHERE prescription.VISITDATETIME = @Today
    AND prescription.VISITNUMBER IN ('TSAI000001', 'TSDI000001', 'TSAD000001');

  DELETE allergy
  FROM dbo.TBLALLERGY AS allergy
  WHERE (LTRIM(RTRIM(allergy.HN)) = 'TESTAI000001' AND LTRIM(RTRIM(allergy.MEDICINECODE)) = '1499900001')
     OR (LTRIM(RTRIM(allergy.HN)) = 'TESTAIDI00001' AND LTRIM(RTRIM(allergy.MEDICINECODE)) = '1499900022');

  DELETE interaction
  FROM dbo.DrugInteraction AS interaction
  WHERE (LTRIM(RTRIM(interaction.StockCode)) = '1499900011' AND LTRIM(RTRIM(interaction.WithStockCode)) = '1499900012')
     OR (LTRIM(RTRIM(interaction.StockCode)) = '1499900021' AND LTRIM(RTRIM(interaction.WithStockCode)) = '1499900022');

  UPDATE patient
  SET patient.FULLNAME_TH = seed.FULLNAME_TH,
      patient.FULLNAME_EN = seed.FULLNAME_TH,
      patient.FIRSTNAME_TH = seed.FIRSTNAME_TH,
      patient.LASTNAME_TH = seed.LASTNAME_TH,
      patient.GENDER = 'U',
      patient.UPDATEDATETIMEMILLISEC = @Now,
      patient.READDATETIME = @Now
  FROM dbo.TBLPATIENT AS patient
  JOIN @Patients AS seed ON seed.PATIENTID = patient.PATIENTID;

  INSERT INTO dbo.TBLPATIENT (
    CREATEDATETIME, PATIENTID, FULLNAME_TH, FULLNAME_EN,
    FIRSTNAME_TH, LASTNAME_TH, GENDER, UPDATEDATETIMEMILLISEC, READDATETIME
  )
  SELECT
    @Now, seed.PATIENTID, seed.FULLNAME_TH, seed.FULLNAME_TH,
    seed.FIRSTNAME_TH, seed.LASTNAME_TH, 'U', @Now, @Now
  FROM @Patients AS seed
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.TBLPATIENT AS patient WHERE patient.PATIENTID = seed.PATIENTID
  );

  UPDATE medicine
  SET medicine.COMMERCIALNAME = seed.COMMERCIALNAME,
      medicine.GENERICNAME = seed.GENERICNAME,
      medicine.LOCALNAME = seed.COMMERCIALNAME,
      medicine.STRENGTH = seed.STRENGTH,
      medicine.DOSAGEFORM = 'TABLET',
      medicine.UNITSEN = 'TAB',
      medicine.UNITSTH = seed.UNITSTH,
      medicine.UPDATEDATETIMEMILLISEC = @Now,
      medicine.READDATETIME = @Now
  FROM dbo.TBLMEDITEMSINFO AS medicine
  JOIN @Medicines AS seed ON seed.MEDICINECODE = medicine.MEDICINECODE;

  INSERT INTO dbo.TBLMEDITEMSINFO (
    CREATEDATETIME, MEDICINECODE, COMMERCIALNAME, GENERICNAME,
    LOCALNAME, STRENGTH, DOSAGEFORM, UNITSEN, UNITSTH,
    UPDATEDATETIMEMILLISEC, READDATETIME
  )
  SELECT
    @Now, seed.MEDICINECODE, seed.COMMERCIALNAME, seed.GENERICNAME,
    seed.COMMERCIALNAME, seed.STRENGTH, 'TABLET', 'TAB', seed.UNITSTH,
    @Now, @Now
  FROM @Medicines AS seed
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.TBLMEDITEMSINFO AS medicine WHERE medicine.MEDICINECODE = seed.MEDICINECODE
  );

  IF EXISTS (SELECT 1 FROM dbo.TBLDOCTOR WHERE DOCTORCODE = 'TSTDR01')
    UPDATE dbo.TBLDOCTOR
    SET LOCALDOCTORNAME = 'TEST Doctor', ENGLISHDOCTORNAME = 'TEST Doctor', UPDATEDATETIMEMILLISEC = @Now, READDATETIME = @Now
    WHERE DOCTORCODE = 'TSTDR01';
  ELSE
    INSERT INTO dbo.TBLDOCTOR (CREATEDATETIME, DOCTORCODE, LOCALDOCTORNAME, ENGLISHDOCTORNAME, UPDATEDATETIMEMILLISEC, READDATETIME)
    VALUES (@Now, 'TSTDR01', 'TEST Doctor', 'TEST Doctor', @Now, @Now);

  IF EXISTS (SELECT 1 FROM dbo.TBLDEPT WHERE DEPTCODE = 'TSTCLINIC')
    UPDATE dbo.TBLDEPT
    SET LOCALWARDNAME = 'TEST OPD Clinic', LOCALENGNAME = 'TEST OPD Clinic', READDATETIME = @Now
    WHERE DEPTCODE = 'TSTCLINIC';
  ELSE
    INSERT INTO dbo.TBLDEPT (CREATEDATETIME, DEPTCODE, LOCALWARDNAME, LOCALENGNAME, READDATETIME)
    VALUES (@Now, 'TSTCLINIC', 'TEST OPD Clinic', 'TEST OPD Clinic', @Now);

  INSERT INTO dbo.TBLORX (
    CREATEDATETIME, VISITDATETIME, VISITNUMBER, PRESCRIPTIONNUMBER,
    PATIENTID, DOCTORORDERCODE, VISITQUEUE, RXQUEUE, ENTRYUSERBY,
    PRIORITY, ORDERSTATUS, READDATETIME, LASTCHANGE_AT, CLINIC_CODE
  )
  SELECT
    seed.CREATEDATETIME, @Today, seed.VISITNUMBER, seed.PRESCRIPTIONNUMBER,
    seed.PATIENTID, 'TSTDR01',
    CASE seed.VISITNUMBER WHEN 'TSAI000001' THEN 901 WHEN 'TSDI000001' THEN 902 ELSE 903 END,
    CONVERT(int, seed.PRESCRIPTIONNUMBER), 'CODEX-SEED',
    'NORMAL', 'ACTIVE', @Now, @Now, 'TSTCLINIC'
  FROM @Prescriptions AS seed;

  INSERT INTO dbo.TBLORXITEMS (
    CREATEDATETIME, VISITDATETIME, VISITNUMBER, PRESCRIPTIONNUMBER,
    MEDICINECODE, PATIENTID, ITEMSEQ, ORDERDATETIME, ORDERQTY,
    ORDERUNITCODE, ISLABELPRINT, PRINTNUM, LASTUPDATEDATETIME,
    USERCDE, READDATETIME, DOSEMEMO_TH, IS_EDITED, IS_DELETED,
    LASTCHANGE_BY, LASTCHANGE_AT
  )
  SELECT
    prescription.CREATEDATETIME, @Today, item.VISITNUMBER, item.PRESCRIPTIONNUMBER,
    item.MEDICINECODE, item.PATIENTID, item.ITEMSEQ, prescription.CREATEDATETIME, item.ORDERQTY,
    item.ORDERUNITCODE, 'N', 0, @Now,
    'CODEX-SEED', @Now, item.DOSEMEMO_TH, 0, 0,
    'CODEX-SEED', @Now
  FROM @Items AS item
  JOIN @Prescriptions AS prescription
    ON prescription.VISITNUMBER = item.VISITNUMBER
   AND prescription.PRESCRIPTIONNUMBER = item.PRESCRIPTIONNUMBER;

  INSERT INTO dbo.TBLALLERGY (
    CREATEDATETIME, HN, MEDICINECODE, SideEffect, ALLERGYTYPE,
    READDATETIME, adverseReactionsDesc, adverseReactionsLocalDesc,
    severity, correlationLevel, certifiedBy, remarks
  )
  VALUES
    (@Now, 'TESTAI000001',  '1499900001', N'ผื่นคันและหายใจติดขัด', 'Drug Allergy', @Now, 'Rash and dyspnea', 'Rash and dyspnea', 'Severe', 'Certain', 'CODEX-SEED', N'ข้อมูลทดสอบ AI เท่านั้น'),
    (@Now, 'TESTAIDI00001', '1499900022', N'ลมพิษ',                 'Drug Allergy', @Now, 'Urticaria',         'Urticaria',         'Moderate', 'Probable', 'CODEX-SEED', N'ข้อมูลทดสอบ AI ร่วมกับ DI');

  INSERT INTO dbo.DrugInteraction (
    StockCode, EnglishName, LocalName,
    WithStockCode, WithStockCodeNameEN, WithStockCodeNameTH,
    LevelType, LevelTypeName, SeverityType, SeverityTypeName,
    EffectsMemo, MechanismMemo, ManagementMemo
  )
  VALUES
    ('1499900011', N'TEST Warfarin 3 mg', N'TEST Warfarin 3 mg',
     '1499900012', N'TEST Aspirin 81 mg', N'TEST Aspirin 81 mg',
     1, N'Major interaction', 1, N'Severe',
     N'ข้อมูลทดสอบ: เพิ่มความเสี่ยงเลือดออก', N'ข้อมูลทดสอบสำหรับหน้า Verify', N'ตรวจสอบความเหมาะสมและเฝ้าระวังอาการเลือดออก'),
    ('1499900021', N'TEST Simvastatin 20 mg', N'TEST Simvastatin 20 mg',
     '1499900022', N'TEST Clarithromycin 500 mg', N'TEST Clarithromycin 500 mg',
     2, N'Clinically significant', 2, N'Moderate',
     N'ข้อมูลทดสอบ: เพิ่มระดับยาและความเสี่ยงกล้ามเนื้อผิดปกติ', N'ข้อมูลทดสอบสำหรับหน้า Verify', N'พิจารณาหลีกเลี่ยงการใช้ร่วมกันหรือเฝ้าระวังอย่างใกล้ชิด');

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;

SELECT
  @Today AS TEST_DATE,
  prescription.VISITNUMBER,
  prescription.PRESCRIPTIONNUMBER,
  prescription.PATIENTID,
  item.MEDICINECODE,
  medicine.COMMERCIALNAME
FROM @Prescriptions AS prescription
JOIN @Items AS item
  ON item.VISITNUMBER = prescription.VISITNUMBER
 AND item.PRESCRIPTIONNUMBER = prescription.PRESCRIPTIONNUMBER
JOIN @Medicines AS medicine ON medicine.MEDICINECODE = item.MEDICINECODE
ORDER BY prescription.VISITNUMBER, prescription.PRESCRIPTIONNUMBER, item.ITEMSEQ;

