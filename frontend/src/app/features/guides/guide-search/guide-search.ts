import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModuleView } from '../../../shared/models/academic-module';
import { CompetencyView } from '../../../shared/models/competency';
import { GuideStatus, GuideView } from '../../../shared/models/guide';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta } from '../../../shared/utils/fechas';
import { CompetencyApi } from '../../academic-program/competency-api';
import { ModuleApi } from '../../academic-program/module-api';
import { FiltroGuias, GuideApi, ResumenGuias } from '../guide-api';

export const MAX_BUSQUEDA = 150; // mismo tope que valida el backend (ListGuidesQuery.search)
const ESPERA_BUSQUEDA_MS = 300;

interface FiltroActivo {
  clave: string;
  texto: string;
}

// Figma HE-06-HU-01 · Buscar guías (CA-01 filtros combinados, CA-02 resultados organizados)
@Component({
  selector: 'app-guide-search',
  imports: [RouterLink, Icon],
  templateUrl: './guide-search.html',
  styleUrl: './guide-search.scss',
})
export class GuideSearch {
  private api = inject(GuideApi);
  private moduleApi = inject(ModuleApi);
  private competencyApi = inject(CompetencyApi);
  private peticion = 0; // descarta respuestas viejas si el usuario filtra rápido
  private espera: ReturnType<typeof setTimeout> | null = null;

  readonly maxBusqueda = MAX_BUSQUEDA;
  readonly opcionesPagina = [10, 20, 50];
  readonly estados: GuideStatus[] = ['Publicada', 'Borrador'];
  fecha = fechaCorta;

  filtro = signal<FiltroGuias>({
    busqueda: '',
    moduleId: null,
    competencyId: null,
    autor: null,
    estado: 'TODOS',
    pagina: 1,
    porPagina: 10,
  });
  /** Lo que se ve en la caja de búsqueda (el filtro se actualiza tras una pausa al escribir). */
  texto = signal('');
  /** Casillas de estado: una marcada filtra por ese estado; ninguna o las dos = todos. */
  estadosMarcados = signal<GuideStatus[]>([]);

  guias = signal<GuideView[]>([]);
  total = signal(0);
  resumen = signal<ResumenGuias | null>(null);
  modulos = signal<ModuleView[]>([]);
  competencias = signal<CompetencyView[]>([]);
  autores = signal<string[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  /** Filtros que se muestran como chips (los que realmente se están aplicando). */
  activos = computed<FiltroActivo[]>(() => {
    const f = this.filtro();
    const lista: FiltroActivo[] = [];
    if (f.busqueda.trim()) lista.push({ clave: 'busqueda', texto: `Búsqueda: ${f.busqueda.trim()}` });
    if (f.moduleId !== null) {
      const modulo = this.modulos().find((m) => m.id === f.moduleId);
      lista.push({ clave: 'modulo', texto: `Módulo: ${modulo?.name ?? f.moduleId}` });
    }
    if (f.competencyId !== null) {
      const competencia = this.competencias().find((c) => c.id === f.competencyId);
      lista.push({ clave: 'competencia', texto: `Competencia: ${competencia?.code ?? f.competencyId}` });
    }
    if (f.estado !== 'TODOS') lista.push({ clave: 'estado', texto: `Estado: ${f.estado}` });
    if (f.autor) lista.push({ clave: 'autor', texto: `Autor: ${f.autor}` });
    return lista;
  });

  totalGlobal = computed(() => this.resumen()?.total ?? 0);
  totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.filtro().porPagina)));
  desde = computed(() => (this.total() === 0 ? 0 : (this.filtro().pagina - 1) * this.filtro().porPagina + 1));
  hasta = computed(() => Math.min(this.filtro().pagina * this.filtro().porPagina, this.total()));
  /** Ventana de hasta 5 páginas alrededor de la actual. */
  paginas = computed(() => {
    const total = this.totalPaginas();
    const actual = this.filtro().pagina;
    const inicio = Math.max(1, Math.min(actual - 2, total - 4));
    const fin = Math.min(total, inicio + 4);
    return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
  });

  constructor() {
    this.cargar();
    this.api.resumen().subscribe({ next: (r) => this.resumen.set(r), error: () => undefined });
    this.moduleApi
      .listar({ busqueda: '', estado: 'TODOS', orden: 'codigo' })
      .subscribe({ next: (m) => this.modulos.set(m), error: () => undefined });
    this.api
      .listar({ busqueda: '', moduleId: null, competencyId: null, autor: null, estado: 'TODOS', pagina: 1, porPagina: 100 })
      .subscribe({
        next: (p) =>
          this.autores.set(
            [...new Set(p.items.map((g) => g.createdBy?.name).filter((n): n is string => !!n))].sort(),
          ),
        error: () => undefined,
      });
  }

  conteo(estado: GuideStatus): string {
    const r = this.resumen();
    if (!r) return '';
    return String(estado === 'Publicada' ? r.publicadas : r.borradores);
  }

  escribir(valor: string): void {
    const texto = valor.slice(0, MAX_BUSQUEDA);
    this.texto.set(texto);
    if (this.espera) clearTimeout(this.espera);
    this.espera = setTimeout(() => this.cambiar({ busqueda: texto }), ESPERA_BUSQUEDA_MS);
  }

  cambiar(cambios: Partial<FiltroGuias>): void {
    this.filtro.update((f) => ({ ...f, pagina: 1, ...cambios }));
    this.cargar();
  }

  filtrarModulo(valor: string): void {
    const moduleId = valor ? Number(valor) : null;
    this.competencias.set([]);
    if (moduleId !== null) {
      this.competencyApi.listar(moduleId).subscribe({ next: (c) => this.competencias.set(c), error: () => undefined });
    }
    this.cambiar({ moduleId, competencyId: null });
  }

  alternarEstado(estado: GuideStatus): void {
    this.estadosMarcados.update((lista) =>
      lista.includes(estado) ? lista.filter((e) => e !== estado) : [...lista, estado],
    );
    const marcados = this.estadosMarcados();
    this.cambiar({ estado: marcados.length === 1 ? marcados[0] : 'TODOS' });
  }

  quitar(clave: string): void {
    switch (clave) {
      case 'busqueda':
        this.texto.set('');
        this.cambiar({ busqueda: '' });
        break;
      case 'modulo':
        this.filtrarModulo('');
        break;
      case 'competencia':
        this.cambiar({ competencyId: null });
        break;
      case 'estado':
        this.estadosMarcados.set([]);
        this.cambiar({ estado: 'TODOS' });
        break;
      case 'autor':
        this.cambiar({ autor: null });
        break;
    }
  }

  limpiar(): void {
    if (this.espera) clearTimeout(this.espera);
    this.texto.set('');
    this.estadosMarcados.set([]);
    this.competencias.set([]);
    this.cambiar({ busqueda: '', moduleId: null, competencyId: null, autor: null, estado: 'TODOS' });
  }

  cambiarPorPagina(valor: string): void {
    this.cambiar({ porPagina: Number(valor) });
  }

  irA(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas() || pagina === this.filtro().pagina) return;
    this.filtro.update((f) => ({ ...f, pagina }));
    this.cargar();
  }

  cargar(): void {
    const id = ++this.peticion;
    this.cargando.set(true);
    this.error.set(null);
    this.api.listar(this.filtro()).subscribe({
      next: (p) => {
        if (id !== this.peticion) return;
        this.guias.set(p.items);
        this.total.set(p.total);
        this.cargando.set(false);
      },
      error: () => {
        if (id !== this.peticion) return;
        this.cargando.set(false);
        this.error.set('No pudimos cargar las guías. Verifica que la API esté disponible e inténtalo de nuevo.');
      },
    });
  }
}
