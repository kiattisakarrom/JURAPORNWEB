import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { DrugAllergyController } from './drug-allergy.controller';
import { DrugAllergyService } from './drug-allergy.service';

describe('DrugAllergyController', () => {
  it('rejects attempts to create allergy records through the API', () => {
    const service = {} as DrugAllergyService;
    const controller = new DrugAllergyController(service);

    expect(() => controller.create()).toThrow(ForbiddenException);
  });
});
