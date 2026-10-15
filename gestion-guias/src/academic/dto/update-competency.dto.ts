import { PartialType } from '@nestjs/mapped-types';
import { CreateCompetencyDto } from './create-competency.dto.js';

export class UpdateCompetencyDto extends PartialType(CreateCompetencyDto, {
  skipNullProperties: false,
}) {}
