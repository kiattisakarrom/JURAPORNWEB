import { Module } from '@nestjs/common';
import { HospitalCallbackTestController } from './hospital-callback-test.controller';
import { HospitalCallbackTestService } from './hospital-callback-test.service';
import { DispensingModule } from '../dispensing/dispensing.module';

@Module({
  imports: [DispensingModule],
  controllers: [HospitalCallbackTestController],
  providers: [HospitalCallbackTestService],
})
export class HospitalCallbackTestModule {}
