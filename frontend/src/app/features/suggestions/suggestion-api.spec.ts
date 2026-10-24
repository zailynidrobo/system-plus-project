import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { MockDb } from '../../core/mock/mock-db';
import { festivosDeColombia, sumarDiasHabiles } from '../../shared/utils/dias-habiles';
import {
  estadoDelPlazo,
  fechaMinimaRequerida,
  plazosDeRespuesta,
  resumenCambio,
  siguienteVersion,
  textoPlazo,
} from '../../shared/utils/sugerencias';
import { RELOJ } from './reloj';
import { FiltroSugerencias, SuggestionApi } from './suggestion-api';

const GB_POO_01 = 2;
const GB_RC_01 = 6;
const SUG_009_APROBADA = 2;
const SUG_013_PAOLA = 5;
const SUG_014_JULIAN = 6;
const PENDIENTES: FiltroSugerencias = { estado: 'Pendiente', moduleId: null, guideId: null, orden: 'antiguas' };
const FEEDBACK = 'Gracias por la propuesta. Con 40 horas no alcanzamos a sustentar a todos los estudiantes.';

describe('SuggestionApi (HE-05)', () => {
  let api: SuggestionApi;
  let db: MockDb;
  /** Reloj de los servicios: por defecto la hora real; algunas pruebas lo fijan. */
  let ahora: Date | null;

  beforeEach(() => {
    limpiarSesion();
    ahora = null;
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA, { provide: RELOJ, useValue: () => ahora ?? new Date() }] });
    api = TestBed.inject(SuggestionApi);
    db = TestBed.inject(MockDb);
  });

  afterEach(limpiarSesion);

  const guia = (id: number) => db.guias.find((g) => g.id === id)!;
  /** Fecha requerida válida: hoy + 14 días. */
  const requerida = () => fechaMinimaRequerida(ahora ?? new Date());

  describe('enviar sugerencia (HU-01)', () => {
    it('queda Pendiente, con código consecutivo, fecha requerida y plazos 5 a 8, sin cambiar la guía', async () => {
      await entrarComo(CORREOS.docente);
      const antes = structuredClone(guia(GB_POO_01).content);
      const s = await firstValueFrom(
        api.enviar({
          guideId: GB_POO_01,
          fieldKey: 'objetivos',
          proposedValue: 'Aplicar encapsulamiento, herencia y polimorfismo en aplicaciones Java con pruebas unitarias.',
          justification: 'Las pruebas unitarias ya hacen parte del módulo y conviene nombrarlas en los objetivos.',
          neededBy: requerida(),
        }),
      );

      expect(s.status).toBe('Pendiente');
      expect(s.code).toBe('SUG-015');
      expect(s.teacherName).toBe('Julián Andrés Ospina');
      expect(s.baseVersion).toBe('v1.0');
      expect(s.neededBy).toBe(requerida());
      expect({ dueSoonAt: s.dueSoonAt, dueAt: s.dueAt }).toEqual(plazosDeRespuesta(s.createdAt));
      expect(s.deadlineStatus).toBe('on_time');
      expect(guia(GB_POO_01).content).toEqual(antes);
    });

    it('valida el cambio y la justificación', async () => {
      await entrarComo(CORREOS.docente);
      const base = {
        guideId: GB_POO_01,
        fieldKey: 'objetivos',
        justification: 'Justificación suficientemente larga para pasar.',
        neededBy: requerida(),
      };
      const actual = guia(GB_POO_01).content['objetivos'];

      expect((await capturarError(api.enviar({ ...base, proposedValue: actual }))).code).toBe('NO_CHANGES');
      expect((await capturarError(api.enviar({ ...base, proposedValue: '' }))).code).toBe('PROPOSAL_REQUIRED');
      expect((await capturarError(api.enviar({ ...base, proposedValue: 'Otro texto', justification: ' ' }))).code).toBe('JUSTIFICATION_REQUIRED');
      expect((await capturarError(api.enviar({ ...base, proposedValue: 'Otro texto', justification: 'Corta' }))).code).toBe('JUSTIFICATION_TOO_SHORT');
      expect((await capturarError(api.enviar({ ...base, fieldKey: 'evaluacion', proposedValue: 'Oral' }))).code).toBe('INVALID_OPTION');
    });

    it('exige la fecha requerida con 14 días de anticipación (13 no, 14 sí)', async () => {
      ahora = new Date('2026-10-24T15:00:00Z'); // sábado 24 oct 2026 en Bogotá
      await entrarComo(CORREOS.docente);
      const base = {
        guideId: GB_POO_01,
        fieldKey: 'objetivos',
        proposedValue: 'Objetivos con pruebas unitarias.',
        justification: 'Justificación suficientemente larga para pasar.',
      };
      expect(fechaMinimaRequerida(ahora)).toBe('2026-11-07');
      expect((await capturarError(api.enviar({ ...base, neededBy: '' }))).code).toBe('NEEDED_BY_REQUIRED');
      expect((await capturarError(api.enviar({ ...base, neededBy: '2026-11-06' }))).code).toBe('NOTICE_TOO_SHORT');
      const s = await firstValueFrom(api.enviar({ ...base, neededBy: '2026-11-07' }));
      expect(s.neededBy).toBe('2026-11-07');
    });

    it('no admite dos sugerencias pendientes del mismo docente sobre el mismo campo', async () => {
      await entrarComo(CORREOS.docente);
      const err = await capturarError(
        api.enviar({
          guideId: GB_POO_01,
          fieldKey: 'criterios',
          proposedValue: 'Otra propuesta distinta',
          justification: 'Justificación suficientemente larga.',
          neededBy: requerida(),
        }),
      );
      expect(err.code).toBe('SUGGESTION_ALREADY_PENDING');
    });

    it('solo se sugiere sobre guías de módulos asignados', async () => {
      await entrarComo(CORREOS.docente);
      const err = await capturarError(
        api.enviar({
          guideId: GB_RC_01,
          fieldKey: 'objetivos',
          proposedValue: 'Otro',
          justification: 'Justificación suficientemente larga.',
          neededBy: requerida(),
        }),
      );
      expect(err.code).toBe('GUIDE_NOT_ASSIGNED');
    });

    it('cada docente ve solo sus sugerencias', async () => {
      await entrarComo(CORREOS.docente);
      const mias = await firstValueFrom(api.misSugerencias());
      expect(mias.map((s) => s.code)).toEqual(['SUG-014', 'SUG-009', 'SUG-006']);
      expect((await capturarError(api.obtenerMia(SUG_013_PAOLA))).code).toBe('NOT_FOUND');
    });
  });

  describe('revisar pendientes (HU-02)', () => {
    it('lista las pendientes de la más antigua a la más reciente y filtra por guía', async () => {
      await entrarComo(CORREOS.coordinador);
      const todas = await firstValueFrom(api.listar(PENDIENTES));
      expect(todas.map((s) => s.code)).toEqual(['SUG-011', 'SUG-012', 'SUG-013', 'SUG-014']);

      const poo = await firstValueFrom(api.listar({ ...PENDIENTES, guideId: GB_POO_01 }));
      expect(poo.map((s) => s.code)).toEqual(['SUG-013', 'SUG-014']);

      // SUG-011 se envió hace 20 días: está vencida, pero sigue pendiente.
      expect(await firstValueFrom(api.resumen())).toEqual({ pendientes: 4, aprobadas: 1, rechazadas: 1, porVencer: 0, vencidas: 1 });
      const vencidas = await firstValueFrom(api.listar({ ...PENDIENTES, plazo: 'overdue' }));
      expect(vencidas.map((s) => [s.code, s.status])).toEqual([['SUG-011', 'Pendiente']]);
    });

    it('un docente no puede revisar ni decidir', async () => {
      await entrarComo(CORREOS.docente);
      expect((await capturarError(api.listar(PENDIENTES))).code).toBe('FORBIDDEN');
      expect((await capturarError(api.aprobar(SUG_014_JULIAN))).code).toBe('FORBIDDEN');
    });
  });

  describe('aprobar (HU-03)', () => {
    it('actualiza el campo de la guía, sube la versión y deja el evento en el historial', async () => {
      await entrarComo(CORREOS.coordinador);
      const versionesAntes = structuredClone(db.versiones);
      const { sugerencia, guia: g } = await firstValueFrom(api.aprobar(SUG_014_JULIAN));

      expect(sugerencia.status).toBe('Aprobada');
      expect(sugerencia.decidedBy?.name).toBe('Laura Muñoz');
      expect(sugerencia.resultingVersion).toBe('v1.1');
      expect(g.version).toBe('v1.1');
      expect(g.content['criterios']).toContain('sustentación oral de 10 minutos');
      expect(db.eventosGuias.some((e) => e.guideId === GB_POO_01 && e.titulo.startsWith('Sugerencia SUG-014 aprobada'))).toBe(true);
      // las versiones personalizadas no cambian
      expect(db.versiones).toEqual(versionesAntes);
    });

    it('avisa al autor y a los demás docentes del módulo', async () => {
      await entrarComo(CORREOS.coordinador);
      const { notificados } = await firstValueFrom(api.aprobar(SUG_014_JULIAN));
      const nuevas = db.notificaciones.filter((n) => n.suggestionId === SUG_014_JULIAN);
      // POO (módulo 2) tiene asignados a Julián (2, el autor), Paola (3) y Santiago (6).
      expect(notificados).toBe(2);
      expect(nuevas.map((n) => [n.recipientId, n.type])).toEqual([
        [2, 'SUGGESTION_APPROVED'],
        [3, 'GUIDE_NEW_VERSION'],
        [6, 'GUIDE_NEW_VERSION'],
      ]);
      expect(nuevas[1].title).toBe('Nueva versión v1.1 de GB-POO-01 disponible');
    });

    it('una vencida sigue pendiente y se puede aprobar', async () => {
      await entrarComo(CORREOS.coordinador);
      const [sug011] = await firstValueFrom(api.listar({ ...PENDIENTES, plazo: 'overdue' }));
      const { sugerencia } = await firstValueFrom(api.aprobar(sug011.id));
      expect(sugerencia.status).toBe('Aprobada');
      expect(sugerencia.deadlineStatus).toBeNull();
    });

    it('no se decide dos veces', async () => {
      await entrarComo(CORREOS.coordinador);
      expect((await capturarError(api.aprobar(SUG_009_APROBADA))).code).toBe('SUGGESTION_ALREADY_DECIDED');
    });

    it('no aplica una sugerencia si el campo cambió después de enviarla', async () => {
      await entrarComo(CORREOS.coordinador);
      guia(GB_POO_01).content['recursos'] = 'Recursos actualizados por otra aprobación';
      expect((await capturarError(api.aprobar(SUG_013_PAOLA))).code).toBe('GUIDE_CHANGED');
    });
  });

  describe('rechazar (HU-04)', () => {
    it('exige motivo y retroalimentación de al menos 30 caracteres', async () => {
      await entrarComo(CORREOS.coordinador);
      expect((await capturarError(api.rechazar(SUG_014_JULIAN, { motivo: '', retroalimentacion: FEEDBACK }))).code).toBe('REASON_REQUIRED');
      expect((await capturarError(api.rechazar(SUG_014_JULIAN, { motivo: 'Otro motivo', retroalimentacion: 'Muy corta' }))).code).toBe('FEEDBACK_TOO_SHORT');
      expect((await capturarError(api.rechazar(SUG_014_JULIAN, { motivo: 'Otro motivo', retroalimentacion: 'x'.repeat(501) }))).code).toBe('FEEDBACK_TOO_LONG');
    });

    it('queda Rechazada con la retroalimentación, la guía no cambia y el docente recibe el aviso', async () => {
      await entrarComo(CORREOS.coordinador);
      const antes = structuredClone(guia(GB_POO_01));
      const s = await firstValueFrom(
        api.rechazar(SUG_014_JULIAN, { motivo: 'No se ajusta a la intensidad horaria del módulo', retroalimentacion: FEEDBACK }),
      );
      expect(s.status).toBe('Rechazada');
      expect(s.feedback).toBe(FEEDBACK);
      expect(guia(GB_POO_01)).toEqual(antes);
      expect(db.notificaciones.at(-1)).toMatchObject({ recipientId: 2, type: 'SUGGESTION_REJECTED', readAt: null });

      // el docente ve la decisión
      await entrarComo(CORREOS.docente);
      const mia = await firstValueFrom(api.obtenerMia(SUG_014_JULIAN));
      expect(mia.rejectReason).toBe('No se ajusta a la intensidad horaria del módulo');
    });
  });

  describe('plazos con el reloj fijo', () => {
    it('on_time, due_soon y overdue según el día hábil 5 y el 8 (con festivos)', async () => {
      ahora = new Date('2026-10-30T15:00:00Z'); // viernes 30 oct 2026, 10:00 a. m. en Bogotá
      await entrarComo(CORREOS.docente);
      const s = await firstValueFrom(
        api.enviar({
          guideId: GB_POO_01,
          fieldKey: 'objetivos',
          proposedValue: 'Objetivos con pruebas unitarias.',
          justification: 'Justificación suficientemente larga para pasar.',
          neededBy: '2026-11-20',
        }),
      );
      // 2 nov es festivo: el día hábil 5 es el 9 nov y el 8 es el 12 nov.
      expect(s.dueSoonAt).toBe('2026-11-10T04:59:59.999Z');
      expect(s.dueAt).toBe('2026-11-13T04:59:59.999Z');

      await entrarComo(CORREOS.coordinador);
      ahora = new Date('2026-11-10T15:00:00Z');
      expect((await firstValueFrom(api.obtener(s.id))).sugerencia).toMatchObject({ deadlineStatus: 'due_soon', businessDaysLeft: 2 });
      ahora = new Date('2026-11-17T15:00:00Z');
      expect((await firstValueFrom(api.obtener(s.id))).sugerencia).toMatchObject({
        status: 'Pendiente',
        deadlineStatus: 'overdue',
        businessDaysOverdue: 2,
      });
    });
  });

  describe('utilidades', () => {
    it('sube la versión menor', () => {
      expect(siguienteVersion('v1.0')).toBe('v1.1');
      expect(siguienteVersion('v2.1')).toBe('v2.2');
    });

    it('suma días hábiles saltando el fin de semana y los festivos de Colombia', () => {
      // viernes 9 oct 2026 + 1 día hábil = martes 13 oct (el lunes 12 es festivo)
      expect(sumarDiasHabiles('2026-10-09', 1)).toBe('2026-10-13');
      const festivos = festivosDeColombia(2026);
      expect(['2026-10-12', '2026-11-02', '2026-11-16'].every((d) => festivos.has(d))).toBe(true);
    });

    it('resume lo agregado al final del texto', () => {
      expect(resumenCambio('Texto base.', 'Texto base. Algo nuevo.')).toBe('Agrega «Algo nuevo.»');
      expect(resumenCambio('Por evidencias', 'Mixta')).toBe('Cambia a «Mixta»');
    });

    it('describe el plazo restante', () => {
      const plazos = plazosDeRespuesta('2026-10-30T15:00:00Z');
      const pendiente = { status: 'Pendiente' as const, ...plazos };
      expect(textoPlazo(estadoDelPlazo(pendiente, new Date('2026-11-03T15:00:00Z')))).toEqual({ texto: 'Vence en 7 días hábiles', tono: 'ok' });
      expect(textoPlazo(estadoDelPlazo(pendiente, new Date('2026-11-11T15:00:00Z')))).toEqual({ texto: 'Por vencer · 1 día hábil', tono: 'aviso' });
      expect(textoPlazo(estadoDelPlazo(pendiente, new Date('2026-11-13T15:00:00Z')))).toEqual({ texto: 'Vencida · sigue pendiente', tono: 'vencida' });
      expect(textoPlazo(estadoDelPlazo({ ...pendiente, status: 'Aprobada' }))).toBeNull();
    });
  });
});
