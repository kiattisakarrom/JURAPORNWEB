import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GetVerifyPrescriptionsQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  patientId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  visitNumber?: string;

  @IsOptional()
  @IsString()
  @IsDateString({ strict: true }, { message: 'fromDate must be a valid date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fromDate must use YYYY-MM-DD format',
  })
  fromDate?: string;

  @IsOptional()
  @IsString()
  @IsDateString({ strict: true }, { message: 'toDate must be a valid date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'toDate must use YYYY-MM-DD format',
  })
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
