import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';

/** Módulo de negocio según el inicio de la ruta, para ubicar el error (RNF-34). */
const MODULOS: [RegExp, string][] = [
  [/^\/auth\b/, 'autenticacion'],
  [/^\/(users|academic\/teachers)\b/, 'usuarios'],
  [/^\/(programs|modules|competencies)\b/, 'programa-academico'],
  [/^\/academic\/guides\/[^/]+\/versions\b/, 'historial'],
  [/^\/academic\/(suggestions|notifications|settings)\b/, 'sugerencias'],
  [/^\/academic\/(personalized-versions|my-assignments)\b/, 'espacio-docente'],
  [/^\/academic\/guides\/[^/]+\/personalized-versions\b/, 'espacio-docente'],
  [/^\/academic\/guides\/?(\?|$)/, 'busqueda'],
  [/^\/academic\b/, 'guias-base'],
  [/^\/audit\b/, 'auditoria'],
];

export function moduloDeRuta(ruta: string): string {
  return MODULOS.find(([patron]) => patron.test(ruta))?.[1] ?? 'general';
}

/**
 * Registra cada error del servidor (5xx o excepción no controlada) como una línea JSON con fecha,
 * severidad, módulo, método, ruta, mensaje y traza (DEF-18). La respuesta al cliente no cambia.
 */
@Catch()
export class ErrorLoggingFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('ErroresServidor');

  catch(exception: unknown, host: ArgumentsHost): void {
    const estado = exception instanceof HttpException ? exception.getStatus() : 500;
    if (estado >= 500 && host.getType() === 'http') {
      const req = host.switchToHttp().getRequest<Request>();
      const ruta = req.originalUrl ?? req.url ?? '';
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        JSON.stringify({
          fecha: new Date().toISOString(),
          severidad: 'ERROR',
          modulo: moduloDeRuta(ruta),
          metodo: req.method,
          ruta,
          estado,
          mensaje: error.message,
          traza: error.stack,
        }),
      );
    }
    super.catch(exception, host);
  }
}
