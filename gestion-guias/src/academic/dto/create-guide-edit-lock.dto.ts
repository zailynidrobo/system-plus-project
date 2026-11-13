import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateGuideEditLockDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
