import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SearchDrugAllergyReferenceDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(100)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class DrugAllergyHistoryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(15)
  patientId!: string;
}
