import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

/** Códigos de error de HE-05. Mismo formato que HE-02: `{ statusCode, error, code, message }`. */
export type SuggestionErrorCode =
  | 'NOT_FOUND'
  | 'GUIDE_NOT_ASSIGNED'
  | 'FIELD_NOT_FOUND'
  | 'NO_CHANGES'
  | 'PROPOSAL_REQUIRED'
  | 'INVALID_OPTION'
  | 'VALUE_TOO_LONG'
  | 'INVALID_NUMBER'
  | 'INVALID_DATE'
  | 'INVALID_VALUE'
  | 'JUSTIFICATION_REQUIRED'
  | 'JUSTIFICATION_TOO_SHORT'
  | 'NEEDED_BY_REQUIRED'
  | 'NEEDED_BY_INVALID'
  | 'NOTICE_TOO_SHORT'
  | 'SUGGESTION_ALREADY_PENDING'
  | 'SUGGESTION_ALREADY_DECIDED'
  | 'GUIDE_NOT_PUBLISHED'
  | 'GUIDE_CHANGED'
  | 'REASON_REQUIRED'
  | 'FEEDBACK_TOO_SHORT'
  | 'FEEDBACK_TOO_LONG';

const body = (
  statusCode: number,
  error: string,
  code: SuggestionErrorCode,
  message: string,
) => ({ statusCode, error, code, message });

export const suggestionBadRequest = (
  code: SuggestionErrorCode,
  message: string,
) => new BadRequestException(body(400, 'Bad Request', code, message));

export const suggestionForbidden = (
  code: SuggestionErrorCode,
  message: string,
) => new ForbiddenException(body(403, 'Forbidden', code, message));

export const suggestionNotFound = (
  code: SuggestionErrorCode,
  message: string,
) => new NotFoundException(body(404, 'Not Found', code, message));

export const suggestionConflict = (
  code: SuggestionErrorCode,
  message: string,
) => new ConflictException(body(409, 'Conflict', code, message));
