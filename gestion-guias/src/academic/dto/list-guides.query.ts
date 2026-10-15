import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { GuideStatus } from '../academic.entities.js';

export class ListGuidesQuery {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsUUID()
  moduleId?: string;

  @IsOptional()
  @IsUUID()
  competencyId?: string;

  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: GuideStatus;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}
