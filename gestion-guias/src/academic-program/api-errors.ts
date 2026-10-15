import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Códigos de error de HE-02. Viajan en el cuerpo de la respuesta junto al mensaje
 * (`{ statusCode, error, code, message }`) para que el front no dependa del texto en español.
 */
export type AcademicErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_STATUS'
  | 'DESCRIPTION_REQUIRED'
  | 'NOTHING_TO_UPDATE'
  | 'MODULE_NOT_ACTIVE'
  | 'MODULE_WITHOUT_COMPETENCIES'
  | 'NO_CHANGES'
  | 'MODULE_NAME_DUPLICATED'
  | 'COMPETENCY_DUPLICATED';

export const notFound = (code: AcademicErrorCode, message: string) =>
  new NotFoundException({
    statusCode: 404,
    error: 'Not Found',
    code,
    message,
  });

export const badRequest = (code: AcademicErrorCode, message: string) =>
  new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    code,
    message,
  });

export const conflict = (code: AcademicErrorCode, message: string) =>
  new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code,
    message,
  });
