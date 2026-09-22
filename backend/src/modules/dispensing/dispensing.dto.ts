import { IsDateString, IsInt, IsNotEmpty, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ChannelClaimDto {
  @IsUUID()
  claimToken!: string;
}

export class TransferPackageDto extends ChannelClaimDto {
  @IsUUID()
  actionId!: string;

  @IsString()
  @IsNotEmpty()
  expectedRowVersion!: string;
}

export class ForceReleaseChannelDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(30)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(120)
  reason!: string;
}

export class ChannelNumberDto {
  @IsInt()
  @Min(1)
  @Max(8)
  channel!: number;
}

export class QueueChangesDto {
  @IsString()
  @Matches(/^\d+$/)
  cursor!: string;
}

export class DispensingHistoryDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  page = 1;
}
