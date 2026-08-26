import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum PackagePageDto {
  PICKING = 'PICKING',
  MATCHING = 'MATCHING',
  CHECKING = 'CHECKING',
  AWAITING_DISPENSING = 'AWAITING_DISPENSING',
  DISPENSING = 'DISPENSING',
  COMPLETE = 'COMPLETE',
}

export enum PackageTransitionActionDto {
  SEND_TO_MATCHING = 'SEND_TO_MATCHING',
  SEND_TO_CHECKING = 'SEND_TO_CHECKING',
  SEND_TO_DISPENSING = 'SEND_TO_DISPENSING',
}

export enum VerifyModeDto {
  NORMAL = 'NORMAL',
  URGENT = 'URGENT',
}

export enum PackagePriorityDto {
  NORMAL = 'NORMAL',
  URGENT = 'URGENT',
}

export enum DispensingPickupStatusDto {
  CALLED_WAITING = 'CALLED_WAITING',
  RECEIVED = 'RECEIVED',
}

export class VisitReferenceDto {
  @IsString()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  visitDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  visitNumber!: string;
}

export class PackageSourceItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  medicineCode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemSeq!: number;
}

export class ClaimVerifyLockDto extends VisitReferenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  workstationCode?: string;
}

export class VerifyLockDto {
  @IsUUID()
  lockToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sessionId!: string;
}

export class VerifyPackageDto extends VerifyLockDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  prescriptionNumber!: string;

  @IsEnum(VerifyModeDto)
  mode!: VerifyModeDto;

  @IsOptional()
  @IsEnum(PackagePriorityDto)
  packagePriority = PackagePriorityDto.NORMAL;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PackageSourceItemDto)
  selectedItems?: PackageSourceItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  actorName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  idempotencyKey!: string;
}

export class SetPackagePendingDto extends VisitReferenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  actorName?: string;
}

export class ActorDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  actorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  workstationCode?: string;
}

export class PackageTransitionDto extends ActorDto {
  @IsEnum(PackageTransitionActionDto)
  action!: PackageTransitionActionDto;
}

export class MatchingPackageScanDto extends ActorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  medicineCode!: string;
}

export class CheckingPackagePairDto extends MatchingPackageScanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  labelQrToken!: string;
}

export class DispensingStatusDto extends ActorDto {
  @IsEnum(DispensingPickupStatusDto)
  status!: DispensingPickupStatusDto;
}

export class PackageWorkflowsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(15)
  patientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  visitNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 200;
}

export class PackagesQueryDto extends PackageWorkflowsQueryDto {
  @IsOptional()
  @IsEnum(PackagePageDto)
  pageNow?: PackagePageDto;
}

