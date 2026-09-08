import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SyncFilterDto {
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
  @IsOptional() @IsString() @MaxLength(15)
  patientId?: string;
  @IsOptional() @IsString() @MaxLength(10)
  visitNumber?: string;
}
export class SyncChangesDto {
  @IsString() @MaxLength(4096) cursor!: string;
}
export class SnapshotPageDto {
  @IsOptional() @IsString() @Matches(/^\d+$/) @MaxLength(10)
  pageCursor = '0';
}
