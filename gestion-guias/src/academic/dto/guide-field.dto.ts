import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Matches,
  ValidateIf,
} from 'class-validator';
import type { GuideFieldType } from '../academic.entities.js';

export class GuideFieldDto {
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/)
  key: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsIn(['text', 'textarea', 'number', 'date', 'select'])
  type: GuideFieldType;

  @IsBoolean()
  required: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  section?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  help?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxLength?: number;

  @IsOptional()
  @IsBoolean()
  teacherEditable?: boolean;
}
