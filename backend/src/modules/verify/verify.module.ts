import { Module } from '@nestjs/common';
import { VerifyController } from './verify.controller';
import { VerifyClinicalAlertService } from './verify-clinical-alert.service';
import { VerifyService } from './verify.service';

@Module({
  controllers: [VerifyController],
  providers: [VerifyClinicalAlertService, VerifyService],
  exports: [VerifyService],
})
export class VerifyModule {}
