import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ListSuggestionsQuery {
  /** Sin valor o `all`: todas. */
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'all'])
  status?: 'pending' | 'approved' | 'rejected' | 'all';

  @IsOptional()
  @IsUUID()
  moduleId?: string;

  @IsOptional()
  @IsUUID()
  guideId?: string;

  /** Por fecha de envío. `asc` (más antiguas primero) por defecto. */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  /** Solo pendientes con ese estado de plazo. */
  @IsOptional()
  @IsIn(['on_time', 'due_soon', 'overdue'])
  deadline?: 'on_time' | 'due_soon' | 'overdue';
}
