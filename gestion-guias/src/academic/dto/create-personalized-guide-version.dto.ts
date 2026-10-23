import { IsOptional, IsString } from 'class-validator';

/** Datos opcionales al crear una versión propia: el nombre con el que el docente la identifica. */
export class CreatePersonalizedGuideVersionDto {
  @IsOptional()
  @IsString()
  name?: string;
}
