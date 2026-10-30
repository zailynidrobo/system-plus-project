import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Miga } from '../../../core/layout/miga';
import { ApiError } from '../../../shared/models/api-error';
import { GuideVersionDetail, GuideVersionItem } from '../../../shared/models/guide-version';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta } from '../../../shared/utils/fechas';
import { Diferencia, diferencia, textoDeValor } from '../../../shared/utils/versiones';
import { GuideApi } from '../guide-api';

interface FilaComparacion {
  key: string;
  label: string;
  izquierda: string;
  derecha: string;
  cambio: boolean;
  dif: Diferencia;
}

// figma he-07-hu-02 ver una version y compararla
@Component({
  selector: 'app-guide-version',
  imports: [RouterLink, Icon],
  templateUrl: './guide-version.html',
  styleUrl: './guide-version.scss',
})
export class GuideVersion {
  private api = inject(GuideApi);
  private miga = inject(Miga);
  readonly id: number;
  readonly version: string;

  actual = signal<GuideVersionDetail | null>(null);
  opciones = signal<GuideVersionItem[]>([]);
  comparada = signal<GuideVersionDetail | null>(null);
  comparandoCon = signal('');
  cargando = signal(true);
  cargandoComparacion = signal(false);
  error = signal<string | null>(null);

  fecha = fechaCorta;

  vigente = computed(() => this.opciones().find((o) => o.estado === 'Vigente') ?? null);
  comparables = computed(() => this.opciones().filter((o) => o.version !== this.version));

  // a la izquierda la mas vieja y a la derecha la mas nueva
  lados = computed(() => {
    const a = this.actual();
    const b = this.comparada();
    if (!a) return null;
    if (!b) return { izquierda: a, derecha: null };
    const orden = (v: string) => this.opciones().findIndex((o) => o.version === v); // 0 es la mas nueva
    return orden(a.version) >= orden(b.version) ? { izquierda: a, derecha: b } : { izquierda: b, derecha: a };
  });

  filas = computed<FilaComparacion[]>(() => {
    const lados = this.lados();
    if (!lados) return [];
    const { izquierda, derecha } = lados;
    const campos = [...(derecha?.fields ?? [])];
    for (const f of izquierda.fields) if (!campos.some((c) => c.key === f.key)) campos.push(f);
    return campos.map((f) => {
      const antes = textoDeValor(izquierda.content[f.key]);
      const despues = derecha ? textoDeValor(derecha.content[f.key]) : '';
      return {
        key: f.key,
        label: f.label,
        izquierda: antes,
        derecha: despues,
        cambio: !!derecha && antes !== despues,
        dif: diferencia(antes, despues),
      };
    });
  });

  modificados = computed(() => this.filas().filter((f) => f.cambio).length);

  constructor() {
    const params = inject(ActivatedRoute).snapshot.paramMap;
    this.id = Number(params.get('id'));
    this.version = params.get('version') ?? '';
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({ detalle: this.api.version(this.id, this.version), historial: this.api.versiones(this.id) }).subscribe({
      next: ({ detalle, historial }) => {
        this.actual.set(detalle);
        this.opciones.set(historial.items);
        this.miga.detalle.set(`Versión ${detalle.version.replace('v', '')}`);
        this.cargando.set(false);
        // compara con la vigente y si ya es la vigente, con la anterior
        const posicion = historial.items.findIndex((o) => o.version === detalle.version);
        const sugerida =
          detalle.estado === 'Vigente' ? historial.items[posicion + 1] : historial.items.find((o) => o.estado === 'Vigente');
        if (sugerida) this.comparar(sugerida.version);
      },
      error: (e) => {
        this.cargando.set(false);
        // si no existe se muestra "la version que buscas no existe", no el error de la api
        if (!(e instanceof ApiError && e.code === 'NOT_FOUND')) {
          this.error.set('No pudimos cargar esta versión. Verifica que la API esté disponible e inténtalo de nuevo.');
        }
      },
    });
  }

  comparar(version: string): void {
    this.comparandoCon.set(version);
    if (!version) {
      this.comparada.set(null);
      return;
    }
    this.cargandoComparacion.set(true);
    this.api.version(this.id, version).subscribe({
      next: (d) => {
        if (this.comparandoCon() !== version) return;
        this.comparada.set(d);
        this.cargandoComparacion.set(false);
      },
      error: () => {
        this.comparada.set(null);
        this.cargandoComparacion.set(false);
      },
    });
  }

  titulo(v: GuideVersionDetail): string {
    return `${v.version.replace('v', '')}`;
  }
}
