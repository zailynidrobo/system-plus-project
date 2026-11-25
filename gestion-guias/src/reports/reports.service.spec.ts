import JSZip from 'jszip';
import { FindOperator } from 'typeorm';
import { CurricularModuleStatus } from '../academic-program/entities/curricular-module.entity.js';
import { construirXlsx } from './reporte-xlsx.js';
import { hojasGuias, hojasSugerencias } from './reportes-documento.js';
import { ReportsService } from './reports.service.js';

const NOW = new Date('2026-11-25T15:00:00.000Z'); // miércoles 25 nov, 10:00 a. m. en Bogotá
const INF = {
  id: 'm-inf',
  code: 'TS-MOD-04',
  name: 'Informática básica',
  sequence: 4,
  status: CurricularModuleStatus.ACTIVE,
};
const PRG = {
  id: 'm-prg',
  code: 'TS-MOD-05',
  name: 'Programación',
  sequence: 5,
  status: CurricularModuleStatus.ACTIVE,
};
const EMP = {
  id: 'm-emp',
  code: 'TS-MOD-07',
  name: 'Emprendimiento',
  sequence: 7,
  status: CurricularModuleStatus.INACTIVE,
};

const guias = [
  {
    id: 'g1',
    moduleId: 'm-inf',
    title: 'Guía INF 1',
    status: 'published',
    updatedAt: new Date('2026-11-10T15:00:00Z'),
  },
  {
    id: 'g2',
    moduleId: 'm-inf',
    title: 'Guía INF 2',
    status: 'draft',
    updatedAt: new Date('2026-11-20T15:00:00Z'),
  },
  {
    id: 'g3',
    moduleId: 'm-prg',
    title: 'Guía PRG 1',
    status: 'published',
    updatedAt: new Date('2026-11-01T15:00:00Z'),
  },
];

const sugerencia = (o: Record<string, unknown>) => ({
  code: 'SUG-0001',
  guideId: 'g1',
  moduleId: 'm-inf',
  fieldLabel: 'Metodología',
  teacherName: 'Ana Pérez',
  status: 'pending',
  decidedAt: null,
  ...o,
});
const sugerencias = [
  // Aprobada en 3 días hábiles, dentro del plazo.
  sugerencia({
    code: 'SUG-0001',
    status: 'approved',
    createdAt: new Date('2026-11-02T15:00:00Z'),
    dueAt: new Date('2026-11-11T04:59:59Z'),
    dueSoonAt: new Date('2026-11-09T04:59:59Z'),
    decidedAt: new Date('2026-11-05T15:00:00Z'),
  }),
  // Rechazada fuera de plazo.
  sugerencia({
    code: 'SUG-0002',
    moduleId: 'm-prg',
    guideId: 'g3',
    status: 'rejected',
    createdAt: new Date('2026-11-03T15:00:00Z'),
    dueAt: new Date('2026-11-06T04:59:59Z'),
    dueSoonAt: new Date('2026-11-05T04:59:59Z'),
    decidedAt: new Date('2026-11-10T15:00:00Z'),
  }),
  // Pendiente y vencida.
  sugerencia({
    code: 'SUG-0003',
    createdAt: new Date('2026-11-12T15:00:00Z'),
    dueAt: new Date('2026-11-20T04:59:59Z'),
    dueSoonAt: new Date('2026-11-18T04:59:59Z'),
  }),
  // Pendiente a tiempo.
  sugerencia({
    code: 'SUG-0004',
    createdAt: new Date('2026-11-24T15:00:00Z'),
    dueAt: new Date('2026-12-04T04:59:59Z'),
    dueSoonAt: new Date('2026-12-02T04:59:59Z'),
  }),
];

function cumple(valor: Date, condicion: FindOperator<Date>): boolean {
  const v = condicion.value as unknown as Date | Date[];
  if (condicion.type === 'between')
    return valor >= (v as Date[])[0] && valor <= (v as Date[])[1];
  if (condicion.type === 'moreThanOrEqual') return valor >= (v as Date);
  if (condicion.type === 'lessThanOrEqual') return valor <= (v as Date);
  throw new Error(condicion.type);
}

function servicio() {
  const repo = <T>(rows: T[]) => ({
    find: async (opciones?: { where?: { createdAt?: FindOperator<Date> } }) => {
      const condicion = opciones?.where?.createdAt;
      return condicion
        ? rows.filter((r) =>
            cumple((r as { createdAt: Date }).createdAt, condicion),
          )
        : rows;
    },
  });
  return new ReportsService(
    repo([INF, PRG, EMP]) as never,
    repo(guias) as never,
    repo(sugerencias) as never,
    { now: () => NOW },
  );
}

describe('Reportes de coordinación', () => {
  it('cuenta las guías de cada módulo por estado, también los módulos sin guías', async () => {
    const r = await servicio().guidesReport();
    expect(r.totals).toEqual({
      modules: 3,
      guides: 3,
      published: 2,
      drafts: 1,
    });
    expect(
      r.rows.map((m) => [
        m.moduleCode,
        m.total,
        m.published,
        m.drafts,
        m.moduleStatus,
      ]),
    ).toEqual([
      ['TS-MOD-04', 2, 1, 1, 'Activo'],
      ['TS-MOD-05', 1, 1, 0, 'Activo'],
      ['TS-MOD-07', 0, 0, 0, 'Inactivo'],
    ]);
    expect(r.rows[0].lastUpdate).toBe('2026-11-20T15:00:00.000Z');
  });

  it('resume las sugerencias con tiempos de respuesta en días hábiles y plazos', async () => {
    const r = await servicio().suggestionsReport({});
    expect(r.totals).toEqual({
      received: 4,
      pending: 2,
      approved: 1,
      rejected: 1,
      overdue: 1,
      averageResponseDays: 4, // 3 y 5 días hábiles
      onTimeRate: 50,
    });
    expect(
      r.byModule.map((m) => [
        m.moduleCode,
        m.received,
        m.averageResponseDays,
        m.lateDecisions,
      ]),
    ).toEqual([
      ['TS-MOD-04', 3, 3, 0],
      ['TS-MOD-05', 1, 5, 1],
    ]);
    expect(r.pending.map((p) => [p.code, p.deadline, p.guideTitle])).toEqual([
      ['SUG-0003', 'Vencida', 'Guía INF 1'],
      ['SUG-0004', 'A tiempo', 'Guía INF 1'],
    ]);
  });

  it('filtra por período en hora de Bogotá, con la fecha final incluida', async () => {
    const r = await servicio().suggestionsReport({
      from: '2026-11-03',
      to: '2026-11-12',
    });
    expect(r.totals.received).toBe(2);
    expect(r.period).toEqual({ from: '2026-11-03', to: '2026-11-12' });
  });

  it('valida las fechas del período', async () => {
    await expect(
      servicio().suggestionsReport({ from: '03/11/2026' }),
    ).rejects.toThrow('AAAA-MM-DD');
    await expect(
      servicio().suggestionsReport({ from: '2026-11-20', to: '2026-11-01' }),
    ).rejects.toThrow('anterior');
  });

  it('arma un Excel válido con una hoja por tabla y los datos escapados', async () => {
    const s = servicio();
    const xlsx = await construirXlsx([
      ...hojasGuias(await s.guidesReport()),
      ...hojasSugerencias(await s.suggestionsReport({})),
    ]);
    const zip = await JSZip.loadAsync(xlsx);
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining([
        'xl/workbook.xml',
        'xl/styles.xml',
        'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet3.xml',
      ]),
    );
    const libro = await zip.file('xl/workbook.xml')!.async('string');
    expect(libro).toContain('name="Guías por módulo"');
    expect(libro).toContain('name="Pendientes"');
    const hoja = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(hoja).toContain('Informática básica');
    expect(hoja).toContain('<v>2</v>');
  });
});
