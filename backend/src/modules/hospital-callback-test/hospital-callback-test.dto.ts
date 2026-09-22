import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class HospitalCallbackTestDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(50)
  vn!: string;

  @IsString()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  visit_date!: string;

  @IsIn(['04'])
  step_id!: '04';

}
