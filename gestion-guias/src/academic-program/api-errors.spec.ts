import { badRequest, conflict, notFound } from './api-errors.js';

describe('api-errors', () => {
  it('incluye el código junto al mensaje en el cuerpo de la respuesta', () => {
    expect(notFound('NOT_FOUND', 'Módulo no encontrado').getResponse()).toEqual(
      {
        statusCode: 404,
        error: 'Not Found',
        code: 'NOT_FOUND',
        message: 'Módulo no encontrado',
      },
    );
    expect(conflict('INVALID_STATUS', 'Estado inválido').getStatus()).toBe(409);
    expect(
      badRequest('NO_CHANGES', 'Sin cambios').getResponse(),
    ).toMatchObject({ statusCode: 400, code: 'NO_CHANGES' });
  });
});
