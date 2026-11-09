import { BadRequestException, NotFoundException } from '@nestjs/common';

/** Códigos de error de HE-08-HU-01. Mismo formato que HE-02: `{ statusCode, error, code, message }`. */
export type AuditErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_DATE'
  | 'INVALID_DATE_RANGE'
  | 'INVALID_RESULT'
  | 'INVALID_MODULE'
  | 'INVALID_PAGE';

export const auditBadRequest = (code: AuditErrorCode, message: string) =>
  new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    code,
    message,
  });

export const auditNotFound = (code: AuditErrorCode, message: string) =>
  new NotFoundException({ statusCode: 404, error: 'Not Found', code, message });
