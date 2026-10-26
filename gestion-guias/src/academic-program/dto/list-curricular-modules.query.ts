import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurricularModuleStatus } from '../entities/curricular-module.entity.js';

export const MODULE_SORT_FIELDS = ['name', 'code', 'updatedAt'] as const;
export type ModuleSortField = (typeof MODULE_SORT_FIELDS)[number];

export class ListCurricularModulesQuery {
  /** Busca por nombre o código. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsIn(Object.values(CurricularModuleStatus), {
    message: `status debe ser uno de: ${Object.values(CurricularModuleStatus).join(', ')}`,
  })
  status?: CurricularModuleStatus;

  @IsOptional()
  @IsIn(MODULE_SORT_FIELDS, {
    message: `sort debe ser uno de: ${MODULE_SORT_FIELDS.join(', ')}`,
  })
  sort?: ModuleSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'order debe ser asc o desc' })
  order?: 'asc' | 'desc';

  /** 'true' -> solo módulos activos con al menos una competencia (selector de nuevas guías). */
  @IsOptional()
  @IsIn(['true', 'false'], {
    message: 'availableForGuides debe ser true o false',
  })
  availableForGuides?: 'true' | 'false';
}
