import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class GetVerifyQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'visitDate must use YYYY-MM-DD format',
  })
  visitDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  visitNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  prescriptionNumber!: string;
}
