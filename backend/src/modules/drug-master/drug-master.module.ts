import { Module } from '@nestjs/common';
import { DrugLabelController } from './drug-label.controller';
import { DrugLabelService } from './drug-label.service';

@Module({
  controllers: [DrugLabelController],
  providers: [DrugLabelService],
  exports: [DrugLabelService],
})
export class DrugMasterModule {}
