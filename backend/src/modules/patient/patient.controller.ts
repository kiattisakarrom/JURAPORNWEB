import { Controller, Get, Param, Query } from '@nestjs/common';
import { GetPatientParamsDto } from './dto/get-patient-params.dto';
import { GetPatientQueryDto } from './dto/get-patient-query.dto';
import { PatientResponse } from './interfaces/patient-response.interface';
import { PatientService } from './patient.service';

@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get(':patientId')
  findPatient(
    @Param() params: GetPatientParamsDto,
    @Query() query: GetPatientQueryDto,
  ): Promise<PatientResponse> {
    return this.patientService.findPatient(
      params.patientId,
      query.vitalSignLimit,
    );
  }
}
