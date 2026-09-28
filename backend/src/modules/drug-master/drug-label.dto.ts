import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveDrugLabelDraftDto {
  @IsString()
  @IsNotEmpty()
  expectedRowVersion!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(25.4)
  @Max(304.8)
  @Type(() => Number)
  widthMm!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(25.4)
  @Max(304.8)
  @Type(() => Number)
  heightMm!: number;

  @IsObject()
  definition!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  actorName?: string;
}

export class SaveDrugLabelLogoDto {
  @IsString()
  @IsNotEmpty()
  expectedRowVersion!: string;

  @IsString()
  @IsIn(['image/png', 'image/jpeg'])
  mimeType!: 'image/png' | 'image/jpeg';

  @IsString()
  @IsNotEmpty()
  @MaxLength(1_500_000)
  dataBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  actorName?: string;
}

export class PublishDrugLabelDraftDto {
  @IsString()
  @IsNotEmpty()
  expectedRowVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  actorName?: string;
}

export class PrintDrugLabelDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  actorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  workstationCode?: string;
}
