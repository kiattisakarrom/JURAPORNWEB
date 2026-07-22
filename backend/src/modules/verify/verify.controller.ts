import { Controller, Get, Query } from '@nestjs/common';
import { GetVerifyPrescriptionsQueryDto } from './dto/get-verify-prescriptions-query.dto';
import { GetVerifyQueryDto } from './dto/get-verify-query.dto';
import { VerifyPrescriptionsResponse } from './interfaces/verify-prescriptions-response.interface';
import { VerifyResponse } from './interfaces/verify-response.interface';
import { VerifyService } from './verify.service';

@Controller('verify')
export class VerifyController {
  constructor(private readonly verifyService: VerifyService) {}

  @Get('prescriptions')
  findPrescriptions(
    @Query() query: GetVerifyPrescriptionsQueryDto,
  ): Promise<VerifyPrescriptionsResponse> {
    return this.verifyService.findPrescriptions(query);
  }

  @Get()
  findPrescription(
    @Query() query: GetVerifyQueryDto,
  ): Promise<VerifyResponse> {
    return this.verifyService.findPrescription(query);
  }
}
