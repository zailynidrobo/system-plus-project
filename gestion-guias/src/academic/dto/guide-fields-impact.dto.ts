import { IsOptional, IsUUID } from 'class-validator';

export class GuideFieldsImpactDto {
  @IsOptional()
  @IsUUID()
  competencyId?: string;
}
