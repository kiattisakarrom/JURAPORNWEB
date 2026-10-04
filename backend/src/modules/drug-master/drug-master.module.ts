import { Module } from '@nestjs/common';
import { DrugAllergyController } from './drug-allergy.controller';
import { DrugAllergyService } from './drug-allergy.service';
import { DrugLabelController } from './drug-label.controller';
import { DrugLabelService } from './drug-label.service';

@Module({
  controllers: [DrugLabelController, DrugAllergyController],
  providers: [DrugLabelService, DrugAllergyService],
  exports: [DrugLabelService],
})
export class DrugMasterModule {}
