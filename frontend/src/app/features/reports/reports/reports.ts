import { Component, computed, inject, signal } from '@angular/core';
import {
  FormatoReporte,
  PeriodoReporte,
  ReporteGuias,
  ReporteSugerencias,
  TipoReporte,
} from '../../../shared/models/reportes';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta, fechaHora } from '../../../shared/utils/fechas';
import { ReportApi } from '../report-api';

type Rango = 'todo' | '30' | '90' | 'anio' | 'personalizado';

const hoyBogota = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const restarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
};

/** HE-11-HU-02 · Reportes de coordinación: guías por módulo y sugerencias con sus tiempos. */
@Component({
  selector: 'app-reports',
  imports: [Icon],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  private api = inject(ReportApi);

  readonly rangos: { valor: Rango; texto: string }[] = [
    { valor: 'todo', texto: 'Todo el historial' },
    { valor: '30', texto: 'Últimos 30 días' },
    { valor: '90', texto: 'Últimos 90 días' },
    { valor: 'anio', texto: 'Este año' },
    { valor: 'personalizado', texto: 'Personalizado' },
  ];
  fecha = fechaCorta;
  fechaHora = fechaHora;

  vista = signal<TipoReporte>('guides');
  guias = signal<ReporteGuias | null>(null);
  sugerencias = signal<ReporteSugerencias | null>(null);
  cargando = signal(false);
  error = signal<string | null>(null);
  descargando = signal<FormatoReporte | null>(null);
  errorDescarga = signal<string | null>(null);

  rango = signal<Rango>('todo');
  desde = signal('');
  hasta = signal('');

  periodo = computed<PeriodoReporte>(() => {
    const hoy = hoyBogota();
    switch (this.rango()) {
      case '30':
        return { desde: restarDias(hoy, 30), hasta: hoy };
      case '90':
        return { desde: restarDias(hoy, 90), hasta: hoy };
      case 'anio':
        return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
      case 'personalizado':
        return { desde: this.desde() || null, hasta: this.hasta() || null };
      default:
        return { desde: null, hasta: null };
    }
  });

  constructor() {
    this.cargar();
  }

  ver(tipo: TipoReporte): void {
    if (this.vista() === tipo) return;
    this.vista.set(tipo);
    this.errorDescarga.set(null);
    this.cargar();
  }

  cambiarRango(valor: string): void {
    this.rango.set(valor as Rango);
    if (valor !== 'personalizado') this.cargar();
  }

  cambiarFecha(campo: 'desde' | 'hasta', valor: string): void {
    this[campo].set(valor);
    const { desde, hasta } = this.periodo();
    if (desde && hasta && desde > hasta) {
      this.error.set('La fecha inicial debe ser anterior a la final.');
      return;
    }
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    const fallo = () => {
      this.cargando.set(false);
      this.error.set(
        'No pudimos cargar el reporte. Verifica que la API esté disponible e inténtalo de nuevo.',
      );
    };
    if (this.vista() === 'guides') {
      this.api.guias().subscribe({
        next: (r) => {
          this.guias.set(r);
          this.cargando.set(false);
        },
        error: fallo,
      });
    } else {
      this.api.sugerencias(this.periodo()).subscribe({
        next: (r) => {
          this.sugerencias.set(r);
          this.cargando.set(false);
        },
        error: fallo,
      });
    }
  }

  descargar(formato: FormatoReporte): void {
    if (this.descargando()) return;
    this.descargando.set(formato);
    this.errorDescarga.set(null);
    const tipo = this.vista();
    this.api.descargar(tipo, formato, this.periodo()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `reporte-${tipo === 'guides' ? 'guias-por-modulo' : 'sugerencias'}-${hoyBogota()}.${formato}`;
        enlace.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.descargando.set(null);
      },
      error: () => {
        this.descargando.set(null);
        this.errorDescarga.set(
          formato === 'pdf'
            ? 'No pudimos generar el PDF. Inténtalo de nuevo o descarga el Excel.'
            : 'No pudimos generar el Excel. Inténtalo de nuevo en unos minutos.',
        );
      },
    });
  }

  dias(valor: number | null): string {
    return valor === null ? '—' : String(valor).replace('.', ',');
  }

  tonoPlazo(plazo: string): string {
    return plazo === 'Vencida' ? 'danger' : plazo === 'Por vencer' ? 'warn' : 'ok';
  }
}
