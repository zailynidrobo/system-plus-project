import { describe, expect, it, vi } from 'vitest';
import { Repository } from 'typeorm';
import { AuditContextResolver } from './audit-context.resolver.js';

const POO = '11111111-1111-4111-8111-111111111111';
const BD = '22222222-2222-4222-8222-222222222222';
const COMPETENCY = '33333333-3333-4333-8333-333333333333';
const GUIDE = '44444444-4444-4444-8444-444444444444';
const VERSION = '55555555-5555-4555-8555-555555555555';
const SUGGESTION = '66666666-6666-4666-8666-666666666666';
const MATERIAL = '77777777-7777-4777-8777-777777777777';

/** Repositorio simulado: busca por id en una lista. */
function repo<T extends { id: string }>(rows: T[]) {
  const byId = (id: string) => rows.find((row) => row.id === id) ?? null;
  return {
    findOneBy: vi.fn(async ({ id }: { id: string }) => byId(id)),
    findOne: vi.fn(async ({ where }: { where: { id: string } }) =>
      byId(where.id),
    ),
  } as unknown as Repository<T>;
}

function createResolver() {
  return new AuditContextResolver(
    repo([
      { id: POO, name: 'Programación Orientada a Objetos' },
      { id: BD, name: 'Bases de Datos' },
    ] as never[]),
    repo([{ id: COMPETENCY, moduleId: BD, code: 'COMP-BD-02' }] as never[]),
    repo([
      { id: GUIDE, moduleId: POO, code: 'GB-POO-01', title: 'Guía de clases' },
    ] as never[]),
    repo([
      {
        id: VERSION,
        moduleId: POO,
        name: 'Mi versión',
        title: 'Guía de clases',
      },
    ] as never[]),
    repo([{ id: SUGGESTION, moduleId: BD, code: 'SUG-014' }] as never[]),
  );
}

describe('Resolvedor de módulo y entidad (HE-08-HU-01)', () => {
  const resolver = createResolver();

  it('ruta con :moduleId: ese mismo módulo', async () => {
    const context = await resolver.resolve({
      method: 'PATCH',
      route: '/modules/:moduleId',
      params: { moduleId: POO },
    });
    expect(context).toEqual({
      entityType: 'module',
      entityId: POO,
      entityLabel: 'Programación Orientada a Objetos',
      moduleId: POO,
      moduleName: 'Programación Orientada a Objetos',
    });
  });

  it('POST programs/:programId/modules: el id de la respuesta', async () => {
    const context = await resolver.resolve({
      method: 'POST',
      route: '/programs/:programId/modules',
      params: { programId: 'p-1' },
      response: { id: BD, name: 'Bases de Datos' },
    });
    expect(context).toMatchObject({
      entityType: 'module',
      moduleId: BD,
      moduleName: 'Bases de Datos',
    });
  });

  it(':competencyId: el módulo de la competencia', async () => {
    const context = await resolver.resolve({
      method: 'PATCH',
      route: '/competencies/:competencyId',
      params: { competencyId: COMPETENCY },
    });
    expect(context).toEqual({
      entityType: 'competency',
      entityId: COMPETENCY,
      entityLabel: 'COMP-BD-02',
      moduleId: BD,
      moduleName: 'Bases de Datos',
    });
  });

  it('guides/:id: el módulo de la guía, con código y título como etiqueta', async () => {
    const context = await resolver.resolve({
      method: 'PATCH',
      route: '/academic/guides/:id/publish',
      params: { id: GUIDE },
    });
    expect(context).toEqual({
      entityType: 'guide',
      entityId: GUIDE,
      entityLabel: 'GB-POO-01 · Guía de clases',
      moduleId: POO,
      moduleName: 'Programación Orientada a Objetos',
    });
  });

  it('guides/:guideId: el módulo de la guía (sugerencia nueva)', async () => {
    const context = await resolver.resolve({
      method: 'POST',
      route: '/academic/guides/:guideId/suggestions',
      params: { guideId: GUIDE },
      response: { id: SUGGESTION, code: 'SUG-015' },
    });
    expect(context).toMatchObject({
      entityType: 'suggestion',
      entityLabel: 'SUG-015',
      moduleId: POO,
    });
  });

  it('POST /academic/guides: el moduleId de la respuesta o, si no, el del cuerpo', async () => {
    const fromResponse = await resolver.resolve({
      method: 'POST',
      route: '/academic/guides',
      params: {},
      body: { moduleId: BD },
      response: {
        id: GUIDE,
        moduleId: POO,
        code: 'GB-POO-02',
        title: 'Taller',
      },
    });
    expect(fromResponse).toMatchObject({
      entityLabel: 'GB-POO-02 · Taller',
      moduleId: POO,
    });

    const fromBody = await resolver.resolve({
      method: 'POST',
      route: '/academic/guides',
      params: {},
      body: { moduleId: BD },
    });
    expect(fromBody.moduleId).toBe(BD);
  });

  it('personalized-versions/:id: el módulo de la versión', async () => {
    const context = await resolver.resolve({
      method: 'PATCH',
      route: '/academic/personalized-versions/:id',
      params: { id: VERSION },
    });
    expect(context).toMatchObject({
      entityType: 'personalized_version',
      entityLabel: 'Mi versión',
      moduleId: POO,
    });
  });

  it('suggestions/:id: el módulo de la sugerencia', async () => {
    const context = await resolver.resolve({
      method: 'PATCH',
      route: '/academic/suggestions/:id/approve',
      params: { id: SUGGESTION },
    });
    expect(context).toMatchObject({
      entityType: 'suggestion',
      entityLabel: 'SUG-014',
      moduleId: BD,
      moduleName: 'Bases de Datos',
    });
  });

  it('material de apoyo y asignación de docentes', async () => {
    const material = await resolver.resolve({
      method: 'DELETE',
      route: '/academic/guides/:id/support-materials/:materialId',
      params: { id: GUIDE, materialId: MATERIAL },
    });
    expect(material).toMatchObject({
      entityType: 'support_material',
      entityId: MATERIAL,
      moduleId: POO,
    });

    const assignment = await resolver.resolve({
      method: 'PUT',
      route: '/academic/modules/:moduleId/teachers/:teacherId',
      params: { moduleId: BD, teacherId: 'teacher-1' },
    });
    expect(assignment).toMatchObject({
      entityType: 'teacher_assignment',
      entityId: 'teacher-1',
      moduleId: BD,
    });
  });

  it('usuarios: sin módulo, con el correo del usuario afectado', async () => {
    const context = await resolver.resolve({
      method: 'PATCH',
      route: '/users/:id/role',
      params: { id: 'user-9' },
      body: { role: 'docente' },
      response: { id: 'user-9', email: 'docente@example.com', role: 'docente' },
    });
    expect(context).toEqual({
      entityType: 'user',
      entityId: 'user-9',
      entityLabel: 'docente@example.com',
      moduleId: null,
      moduleName: null,
    });
  });

  it('sesión: sin módulo', async () => {
    const context = await resolver.resolve({
      method: 'POST',
      route: '/auth/login',
      params: {},
    });
    expect(context.moduleId).toBeNull();
    expect(context.moduleName).toBeNull();
  });

  it('no consulta la base con ids que no son uuid (p. ej. en un acceso denegado)', async () => {
    const context = await resolver.resolve({
      method: 'PATCH',
      route: '/academic/guides/:id',
      params: { id: 'no-es-un-uuid' },
    });
    expect(context.moduleId).toBeNull();
  });
});
