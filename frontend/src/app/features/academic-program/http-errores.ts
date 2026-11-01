import { HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { ApiError } from '../../shared/models/api-error';

/** Cuerpo de error del backend: { statusCode, error, code?, message, existingModule?, existingCompetency? }. */
interface CuerpoError {
  code?: string;
  message?: string | string[];
  existingModule?: unknown;
  existingCompetency?: { code: string };
}

/**
 * Convierte un error HTTP del backend en el ApiError que esperan las pantallas.
 *  · Si el backend manda `code` (NOT_FOUND, INVALID_STATUS, MODULE_NAME_DUPLICATED...) se usa tal cual.
 *  · Sin `code`: 404 -> NOT_FOUND, 400 -> VALIDATION_ERROR (con los mensajes), 401/403 -> SIN_PERMISO.
 *  · Cualquier otro caso (sin conexión, 5xx) -> ERROR_DE_SERVIDOR.
 *
 * `aModulo` convierte el módulo existente de un MODULE_NAME_DUPLICATED al formato del front.
 */
export function traducirError(e: unknown, aModulo?: (m: never) => unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (!(e instanceof HttpErrorResponse)) return new ApiError('ERROR_DE_SERVIDOR', { estado: 0 });

  const cuerpo = (e.error && typeof e.error === 'object' ? e.error : {}) as CuerpoError;
  if (cuerpo.code === 'MODULE_NAME_DUPLICATED') {
    const existente =
      aModulo && cuerpo.existingModule
        ? aModulo(cuerpo.existingModule as never)
        : cuerpo.existingModule;
    return new ApiError(cuerpo.code, existente);
  }
  if (cuerpo.code === 'COMPETENCY_DUPLICATED') {
    return new ApiError(cuerpo.code, { code: cuerpo.existingCompetency?.code ?? '' });
  }
  if (cuerpo.code) return new ApiError(cuerpo.code);

  if (e.status === 404) return new ApiError('NOT_FOUND');
  if (e.status === 400) {
    const mensajes = Array.isArray(cuerpo.message)
      ? cuerpo.message
      : cuerpo.message
        ? [cuerpo.message]
        : [];
    return new ApiError('VALIDATION_ERROR', { mensajes });
  }
  if (e.status === 401 || e.status === 403) return new ApiError('SIN_PERMISO');
  return new ApiError('ERROR_DE_SERVIDOR', { estado: e.status });
}

/** Para usar dentro de `catchError`: relanza el error ya traducido. */
export const falla = (aModulo?: (m: never) => unknown) => (e: unknown) =>
  throwError(() => traducirError(e, aModulo));
