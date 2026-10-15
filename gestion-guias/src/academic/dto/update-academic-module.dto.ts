import { PartialType } from '@nestjs/mapped-types';
import { CreateAcademicModuleDto } from './create-academic-module.dto.js';

export class UpdateAcademicModuleDto extends PartialType(CreateAcademicModuleDto, {
  skipNullProperties: false,
}) {}
