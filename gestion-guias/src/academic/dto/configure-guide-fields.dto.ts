import { ArrayUnique, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GuideFieldDto } from './guide-field.dto.js';

export class ConfigureGuideFieldsDto {
  @IsArray()
  @ArrayUnique((field: GuideFieldDto) => field.key)
  @ValidateNested({ each: true })
  @Type(() => GuideFieldDto)
  fields: GuideFieldDto[];
}
