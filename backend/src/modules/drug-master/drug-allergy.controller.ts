import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  DrugAllergyHistoryDto,
  SearchDrugAllergyReferenceDto,
} from './drug-allergy.dto';
import { DrugAllergyService } from './drug-allergy.service';

@Controller('drug-allergies')
export class DrugAllergyController {
  constructor(private readonly service: DrugAllergyService) {}

  @Post('search-patients')
  @HttpCode(HttpStatus.OK)
  searchPatients(@Body() body: SearchDrugAllergyReferenceDto) {
    return this.service.searchPatients(body);
  }

  @Post('search-medicines')
  @HttpCode(HttpStatus.OK)
  searchMedicines(@Body() body: SearchDrugAllergyReferenceDto) {
    return this.service.searchMedicines(body);
  }

  @Post('history')
  @HttpCode(HttpStatus.OK)
  history(@Body() body: DrugAllergyHistoryDto) {
    return this.service.history(body.patientId);
  }

  @Post()
  create(): never {
    throw new ForbiddenException(
      'Drug allergy records are read-only and must be supplied by the hospital source system',
    );
  }
}
