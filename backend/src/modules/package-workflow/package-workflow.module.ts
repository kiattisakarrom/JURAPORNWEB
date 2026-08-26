import { Module } from '@nestjs/common';
import { VerifyModule } from '../verify/verify.module';
import { PackageWorkflowController } from './package-workflow.controller';
import { PackageWorkflowService } from './package-workflow.service';

@Module({
  imports: [VerifyModule],
  controllers: [PackageWorkflowController],
  providers: [PackageWorkflowService],
})
export class PackageWorkflowModule {}

