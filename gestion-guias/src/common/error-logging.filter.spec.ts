import { ArgumentsHost, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorLoggingFilter, moduloDeRuta } from './error-logging.filter.js';

function host(url: string): ArgumentsHost {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), headersSent: false };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ method: 'GET', originalUrl: url }), getResponse: () => res }),
    getArgByIndex: (i: number) => [{ method: 'GET', originalUrl: url }, res][i],
    getArgs: () => [{}, res],
  } as unknown as ArgumentsHost;
}

const adaptador = { reply: vi.fn(), isHeadersSent: () => false, end: vi.fn() };

describe('Registro de errores del servidor (DEF-18, RNF-34)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('registra un 500 con fecha, severidad, módulo, ruta y traza', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    new ErrorLoggingFilter(adaptador as never).catch(new Error('falló la consulta'), host('/audit/actions?x=1'));
    const evento = JSON.parse(log.mock.calls[0][0] as string);
    expect(evento).toMatchObject({ severidad: 'ERROR', modulo: 'auditoria', metodo: 'GET', ruta: '/audit/actions?x=1', estado: 500, mensaje: 'falló la consulta' });
    expect(evento.fecha).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(evento.traza).toContain('falló la consulta');
  });

  it('también registra las excepciones 5xx de Nest', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    new ErrorLoggingFilter(adaptador as never).catch(new InternalServerErrorException('x'), host('/users'));
    expect(JSON.parse(log.mock.calls[0][0] as string).modulo).toBe('usuarios');
  });

  it('no registra como error las respuestas 4xx', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    new ErrorLoggingFilter(adaptador as never).catch(new BadRequestException('dato inválido'), host('/users'));
    expect(log).not.toHaveBeenCalled();
  });

  it('ubica el módulo de negocio por la ruta', () => {
    expect(moduloDeRuta('/academic/guides/abc/versions/2')).toBe('historial');
    expect(moduloDeRuta('/academic/guides?q=poo')).toBe('busqueda');
    expect(moduloDeRuta('/academic/guides/abc')).toBe('guias-base');
    expect(moduloDeRuta('/academic/personalized-versions/1')).toBe('espacio-docente');
    expect(moduloDeRuta('/academic/suggestions')).toBe('sugerencias');
    expect(moduloDeRuta('/programs/1/modules')).toBe('programa-academico');
  });
});
