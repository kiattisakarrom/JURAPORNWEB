import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { VerifyService } from './verify.service';

describe('VerifyService', () => {
  const query = {
    visitDate: '2026-07-14',
    visitNumber: 'VN0001',
    prescriptionNumber: 'RX0001',
  };

  it('maps joined rows into one prescription with items', async () => {
    const request = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [
          {
            VISITDATETIME: new Date('2026-07-14T00:00:00.000Z'),
            VISITNUMBER: 'VN0001',
            PRESCRIPTIONNUMBER: 'RX0001',
            PATIENTID: 'HN0001',
            FULLNAME_TH: 'ผู้ป่วยทดสอบ',
            DOCTORCODE: 'DR001',
            LOCALDOCTORNAME: 'แพทย์ทดสอบ',
            ITEMSEQ: 1,
            MEDICINECODE: 'MED001',
            COMMERCIALNAME: 'Medicine A',
            ORDERQTY: 10,
            ORDERUNITCODE: 'TAB',
            DOSEMEMO_TH: 'รับประทานครั้งละ 1 เม็ด หลังอาหาร',
          },
          {
            VISITDATETIME: new Date('2026-07-14T00:00:00.000Z'),
            VISITNUMBER: 'VN0001',
            PRESCRIPTIONNUMBER: 'RX0001',
            PATIENTID: 'HN0001',
            FULLNAME_TH: 'ผู้ป่วยทดสอบ',
            DOCTORCODE: 'DR001',
            LOCALDOCTORNAME: 'แพทย์ทดสอบ',
            ITEMSEQ: 2,
            MEDICINECODE: 'MED002',
            COMMERCIALNAME: 'Medicine B',
            ORDERQTY: 5,
            ORDERUNITCODE: 'CAP',
            DOSEMEMO_TH: null,
          },
        ],
      }),
    };
    const databaseService = {
      createRequest: jest.fn().mockReturnValue(request),
    } as unknown as DatabaseService;
    const service = new VerifyService(databaseService);

    const result = await service.findPrescription(query);

    expect(result.VISITDATETIME).toBe('2026-07-14');
    expect(result.PATIENT.PATIENTID).toBe('HN0001');
    expect(result.DOCTOR.DOCTORCODE).toBe('DR001');
    expect(result.ITEMS).toHaveLength(2);
    expect(result.ITEMS[0].DOSEMEMO_TH).toBe(
      'รับประทานครั้งละ 1 เม็ด หลังอาหาร',
    );
    expect(request.input).toHaveBeenCalledTimes(3);
  });

  it('throws NotFoundException when the prescription does not exist', async () => {
    const request = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [] }),
    };
    const databaseService = {
      createRequest: jest.fn().mockReturnValue(request),
    } as unknown as DatabaseService;
    const service = new VerifyService(databaseService);

    await expect(service.findPrescription(query)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('groups every prescription and item for a selected patient', async () => {
    const countRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{ TOTAL_PATIENTS: 1 }],
      }),
    };
    const dataRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [
          {
            VISITDATETIME: new Date('2026-07-14T00:00:00.000Z'),
            VISITNUMBER: 'VN0001',
            PRESCRIPTIONNUMBER: 'RX0001',
            PATIENTID: 'HN0001',
            FULLNAME_TH: 'ผู้ป่วยทดสอบ',
            DOCTORCODE: 'DR001',
            LOCALDOCTORNAME: 'แพทย์ทดสอบ',
            ITEMSEQ: 1,
            MEDICINECODE: 'MED001',
            COMMERCIALNAME: 'Medicine A',
            ORDERQTY: 10,
            ORDERUNITCODE: 'TAB',
            DOSEMEMO_TH: 'รับประทานครั้งละ 1 เม็ด หลังอาหาร',
          },
          {
            VISITDATETIME: new Date('2026-07-14T00:00:00.000Z'),
            VISITNUMBER: 'VN0001',
            PRESCRIPTIONNUMBER: 'RX0001',
            PATIENTID: 'HN0001',
            FULLNAME_TH: 'ผู้ป่วยทดสอบ',
            DOCTORCODE: 'DR001',
            LOCALDOCTORNAME: 'แพทย์ทดสอบ',
            ITEMSEQ: 2,
            MEDICINECODE: 'MED002',
            COMMERCIALNAME: null,
            ORDERQTY: 5,
            ORDERUNITCODE: 'CAP',
            DOSEMEMO_TH: null,
          },
        ],
      }),
    };
    const databaseService = {
      createRequest: jest
        .fn()
        .mockReturnValueOnce(countRequest)
        .mockReturnValueOnce(dataRequest),
    } as unknown as DatabaseService;
    const service = new VerifyService(databaseService);

    const result = await service.findPrescriptions({
      patientId: 'HN0001',
      page: 1,
      limit: 20,
    });

    expect(result.PAGINATION.TOTAL_PATIENTS).toBe(1);
    expect(result.PATIENTS).toHaveLength(1);
    expect(result.PATIENTS[0].PRESCRIPTIONS).toHaveLength(1);
    expect(result.PATIENTS[0].PRESCRIPTIONS[0].ITEMS).toHaveLength(2);
    expect(
      result.PATIENTS[0].PRESCRIPTIONS[0].ITEMS[0].DOSEMEMO_TH,
    ).toBe('รับประทานครั้งละ 1 เม็ด หลังอาหาร');
    expect(countRequest.input).toHaveBeenCalledWith(
      'patientId',
      expect.anything(),
      'HN0001',
    );
  });

  it('requires a patient or a complete valid date range', async () => {
    const databaseService = {
      createRequest: jest.fn(),
    } as unknown as DatabaseService;
    const service = new VerifyService(databaseService);

    await expect(
      service.findPrescriptions({ page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.findPrescriptions({
        fromDate: '2026-07-31',
        toDate: '2026-07-01',
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(databaseService.createRequest).not.toHaveBeenCalled();
  });
});
