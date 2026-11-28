import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { OFFICE_EXPERIENCES, type OfficeExperience } from '../office-experience';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format jam HH:mm' })
  workStart?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format jam HH:mm' })
  workEnd?: string;

  /** Ganti tampilan office: 'classic' (office lama) atau 'new' (Office Baru). */
  @IsOptional()
  @IsIn(OFFICE_EXPERIENCES)
  experience?: OfficeExperience;
}
