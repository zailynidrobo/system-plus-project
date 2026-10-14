import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { MockDb } from '../../core/mock/mock-db';
import { plazo, resumenCambio, siguienteVersion, sumarDiasHabiles } from '../../shared/utils/sugerencias';
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

  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(SuggestionApi);
    db = TestBed.inject(MockDb);
  });

  afterEach(limpiarSesion);

  const guia = (id: number) => db.guias.find((g) => g.id === id)!;

  describe('enviar sugerencia (HU-01)', () => {
    it('queda Pendiente, con código consecutivo y plazo de 5 días hábiles, sin cambiar la guía', async () => {
      await entrarComo(CORREOS.docente);
      const antes = structuredClone(guia(GB_POO_01).content);
      const s = await firstValueFrom(
        api.enviar({
          guideId: GB_POO_01,
          fieldKey: 'objetivos',
          proposedValue: 'Aplicar encapsulamiento, herencia y polimorfismo en aplicaciones Java con pruebas unitarias.',
          justification: 'Las pruebas unitarias ya hacen parte del módulo y conviene nombrarlas en los objetivos.',
        }),
      );

      expect(s.status).toBe('Pendiente');
      expect(s.code).toBe('SUG-015');
      expect(s.teacherName).toBe('Julián Andrés Ospina');
      expect(s.baseVersion).toBe('v1.0');
      expect(s.dueAt).toBe(sumarDiasHabiles(s.createdAt, 5));
      expect(guia(GB_POO_01).content).toEqual(antes);
    });

    it('valida el cambio y la justificación', async () => {
      await entrarComo(CORREOS.docente);
      const base = { guideId: GB_POO_01, fieldKey: 'objetivos', justification: 'Justificación suficientemente larga para pasar.' };
      const actual = guia(GB_POO_01).content['objetivos'];

      expect((await capturarError(api.enviar({ ...base, proposedValue: actual }))).code).toBe('NO_CHANGES');
      expect((await capturarError(api.enviar({ ...base, proposedValue: '' }))).code).toBe('PROPOSAL_REQUIRED');
      expect((await capturarError(api.enviar({ ...base, proposedValue: 'Otro texto', justification: ' ' }))).code).toBe('JUSTIFICATION_REQUIRED');
      expect((await capturarError(api.enviar({ ...base, proposedValue: 'Otro texto', justification: 'Corta' }))).code).toBe('JUSTIFICATION_TOO_SHORT');
      expect((await capturarError(api.enviar({ ...base, fieldKey: 'evaluacion', proposedValue: 'Oral' }))).code).toBe('INVALID_OPTION');
    });

    it('no admite dos sugerencias pendientes del mismo docente sobre el mismo campo', async () => {
      await entrarComo(CORREOS.docente);
      const err = await capturarError(
        api.enviar({ guideId: GB_POO_01, fieldKey: 'criterios', proposedValue: 'Otra propuesta distinta', justification: 'Justificación suficientemente larga.' }),
      );
      expect(err.code).toBe('SUGGESTION_ALREADY_PENDING');
    });

    it('solo se sugiere sobre guías de módulos asignados', async () => {
      await entrarComo(CORREOS.docente);
      const err = await capturarError(
        api.enviar({ guideId: GB_RC_01, fieldKey: 'objetivos', proposedValue: 'Otro', justification: 'Justificación suficientemente larga.' }),
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

      expect(await firstValueFrom(api.resumen())).toEqual({ pendientes: 4, aprobadas: 1, rechazadas: 1 });
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

    it('queda Rechazada con la retroalimentación y la guía no cambia', async () => {
      await entrarComo(CORREOS.coordinador);
      const antes = structuredClone(guia(GB_POO_01));
      const s = await firstValueFrom(
        api.rechazar(SUG_014_JULIAN, { motivo: 'No se ajusta a la intensidad horaria del módulo', retroalimentacion: FEEDBACK }),
      );
      expect(s.status).toBe('Rechazada');
      expect(s.feedback).toBe(FEEDBACK);
      expect(guia(GB_POO_01)).toEqual(antes);

      // el docente ve la decisión
      await entrarComo(CORREOS.docente);
      const mia = await firstValueFrom(api.obtenerMia(SUG_014_JULIAN));
      expect(mia.rejectReason).toBe('No se ajusta a la intensidad horaria del módulo');
    });
  });

  describe('utilidades', () => {
    it('sube la versión menor', () => {
      expect(siguienteVersion('v1.0')).toBe('v1.1');
      expect(siguienteVersion('v2.1')).toBe('v2.2');
    });

    it('suma días hábiles saltando el fin de semana', () => {
      // viernes 9 oct 2026 + 1 día hábil = lunes 12 oct
      expect(new Date(sumarDiasHabiles('2026-10-09T12:00:00', 1)).getDate()).toBe(12);
    });

    it('resume lo agregado al final del texto', () => {
      expect(resumenCambio('Texto base.', 'Texto base. Algo nuevo.')).toBe('Agrega «Algo nuevo.»');
      expect(resumenCambio('Por evidencias', 'Mixta')).toBe('Cambia a «Mixta»');
    });

    it('calcula el plazo restante', () => {
      const hoy = new Date('2026-10-12T10:00:00');
      expect(plazo('2026-10-15T10:00:00', hoy)).toEqual({ texto: 'Vence en 3 días', vencida: false });
      expect(plazo('2026-10-10T10:00:00', hoy)).toEqual({ texto: 'Venció hace 2 días', vencida: true });
    });
  });
});
