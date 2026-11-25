import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ReportApi } from '../report-api';
import { Reports } from './reports';

describe('Reportes', () => {
  const sugerencias = vi.fn((_periodo: { desde: string | null; hasta: string | null }) =>
    of({
      generatedAt: '2026-11-25T15:00:00.000Z',
      period: { from: null, to: null },
      totals: {
        received: 4,
        pending: 2,
        approved: 1,
        rejected: 1,
        overdue: 1,
        averageResponseDays: 4,
        onTimeRate: 50,
      },
      byModule: [],
      pending: [],
    }),
  );
  const descargar = vi.fn((..._args: unknown[]) => of(new Blob(['x'])));

  beforeEach(() => {
    sugerencias.mockClear();
    descargar.mockClear();
    TestBed.configureTestingModule({
      imports: [Reports],
      providers: [
        {
          provide: ReportApi,
          useValue: {
            guias: () =>
              of({
                generatedAt: '2026-11-25T15:00:00.000Z',
                totals: { modules: 1, guides: 2, published: 1, drafts: 1 },
                rows: [
                  {
                    moduleCode: 'TS-MOD-05',
                    moduleName: 'Programación',
                    moduleStatus: 'Activo',
                    total: 2,
                    published: 1,
                    drafts: 1,
                    lastUpdate: null,
                  },
                ],
              }),
            sugerencias,
            descargar,
          },
        },
      ],
    });
  });

  it('muestra primero las guías por módulo', () => {
    const fixture = TestBed.createComponent(Reports);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Programación');
    expect(texto).toContain('Borradores');
  });

  it('el período de los últimos 30 días termina hoy', () => {
    const fixture = TestBed.createComponent(Reports);
    const c = fixture.componentInstance;
    c.ver('suggestions');
    c.cambiarRango('30');
    const { desde, hasta } = sugerencias.mock.calls.at(-1)![0] as { desde: string; hasta: string };
    expect(hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((Date.parse(hasta) - Date.parse(desde)) / 86_400_000).toBe(30);
  });

  it('no consulta si la fecha inicial es posterior a la final', () => {
    const c = TestBed.createComponent(Reports).componentInstance;
    c.ver('suggestions');
    c.cambiarRango('personalizado');
    const llamadas = sugerencias.mock.calls.length;
    c.cambiarFecha('desde', '2026-11-20');
    c.cambiarFecha('hasta', '2026-11-01');
    expect(c.error()).toContain('anterior');
    expect(sugerencias.mock.calls.length).toBe(llamadas + 1);
  });

  it('descarga el reporte visible en el formato elegido', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const c = TestBed.createComponent(Reports).componentInstance;
    c.descargar('xlsx');
    expect(descargar).toHaveBeenCalledWith('guides', 'xlsx', { desde: null, hasta: null });
  });
});
