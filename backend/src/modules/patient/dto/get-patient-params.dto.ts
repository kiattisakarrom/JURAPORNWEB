import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GetPatientParamsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  patientId!: string;
}
