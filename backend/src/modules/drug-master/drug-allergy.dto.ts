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

export class CreateDrugAllergyDto extends DrugAllergyHistoryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(30)
  medicineCode!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(1000)
  sideEffect!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(100)
  allergyType!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(100)
  severity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adverseReactionLocal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adverseReactionEnglish?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(100)
  correlationLevel!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(150)
  certifiedBy!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  remarks?: string;
}
