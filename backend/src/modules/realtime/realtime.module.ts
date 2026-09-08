import { Module } from '@nestjs/common';
import { VerifyModule } from '../verify/verify.module';
import { PackageWorkflowModule } from '../package-workflow/package-workflow.module';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { ChangeTrackingRepository } from './change-tracking.repository';

@Module({imports:[VerifyModule,PackageWorkflowModule],controllers:[RealtimeController],providers:[RealtimeService,ChangeTrackingRepository]})
export class RealtimeModule {}
