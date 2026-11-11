import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DetalleEventoAuditoria,
  EventoAuditoria,
  FiltroAuditoria,
  OpcionesAuditoria,
  RESULTADOS,
} from '../../../shared/models/audit';
import { Icon } from '../../../shared/ui/icon/icon';
import {
  aCsv,
  fechaHoraBogota,
  fechaHoraSegundosBogota,
  hoyBogota,
  inicialesAuditoria,
  nombreAuditoria,
  numero,
  siglas,
  sumarDias,
  tonoAccion,
} from '../../../shared/utils/auditoria';
import { AuditApi } from '../audit-api';

export const MAX_BUSQUEDA = 100;
const ESPERA_BUSQUEDA_MS = 300;
const POR_PAGINA = 10;
const POR_PAGINA_EXPORTAR = 100; // lo maximo que deja el back
const MAX_EXPORTAR = 5000;

type Rango = '7' | '30' | '90' | 'todo';

interface FiltroActivo {
  clave: string;
  texto: string;
}

// Figma HE-08-HU-01 · registro de auditoría (CA-01 registro, CA-02 filtro por usuario o módulo)
@Component({
  selector: 'app-audit-log',
  imports: [Icon],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.scss',
  host: { '(document:keydown.escape)': 'cerrarDetalle()' },
})
export class AuditLog {
  private api = inject(AuditApi);
  private peticion = 0; // descarta respuestas viejas si el usuario filtra rapido
  private espera: ReturnType<typeof setTimeout> | null = null;

  readonly maxBusqueda = MAX_BUSQUEDA;
  readonly rangos: { valor: Rango; texto: string }[] = [
    { valor: '7', texto: 'Últimos 7 días' },
    { valor: '30', texto: 'Últimos 30 días' },
    { valor: '90', texto: 'Últimos 90 días' },
    { valor: 'todo', texto: 'Todo el historial' },
  ];
  readonly etiquetaResultado = RESULTADOS;
  fecha = fechaHoraSegundosBogota;
  fechaDetalle = fechaHoraBogota;
  nombre = nombreAuditoria;
  iniciales = inicialesAuditoria;
  siglas = siglas;
  tono = tonoAccion;
  numero = numero;

  rango = signal<Rango>('30');
  filtro = signal<FiltroAuditoria>({
    busqueda: '',
    userId: null,
    moduleId: null,
    area: null,
    resultado: 'TODOS',
    desde: this.desdeDe('30'),
    hasta: '',
    pagina: 1,
    porPagina: POR_PAGINA,
  });
  /** Lo que se ve en la caja de busqueda (el filtro cambia despues de una pausa). */
  texto = signal('');

  eventos = signal<EventoAuditoria[]>([]);
  total = signal(0);
  opciones = signal<OpcionesAuditoria>({ users: [], modules: [], areas: [] });
  /** Tarjetas de arriba: null mientras cargan o si fallan. */
  eventosDelRango = signal<number | null>(null);
  cambiosDePermisos = signal<number | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);
  exportando = signal(false);
  errorExportar = signal<string | null>(null);

  seleccionado = signal<DetalleEventoAuditoria | null>(null);
  cargandoDetalle = signal(false);
  errorDetalle = signal<string | null>(null);

  textoRango = computed(() => (this.rango() === 'todo' ? 'en total' : `últimos ${this.rango()} días`));

  /** Filtros que se muestran como chips (el rango de fechas no cuenta: siempre hay uno). */
  activos = computed<FiltroActivo[]>(() => {
    const f = this.filtro();
    const o = this.opciones();
    const lista: FiltroActivo[] = [];
    if (f.busqueda.trim()) lista.push({ clave: 'busqueda', texto: `Búsqueda: ${f.busqueda.trim()}` });
    if (f.userId) lista.push({ clave: 'usuario', texto: `Usuario: ${o.users.find((u) => u.id === f.userId)?.name ?? f.userId}` });
    if (f.moduleId) lista.push({ clave: 'modulo', texto: `Módulo: ${o.modules.find((m) => m.id === f.moduleId)?.name ?? f.moduleId}` });
    return lista;
  });
  moduloFiltrado = computed(() => {
    const id = this.filtro().moduleId;
    return id ? (this.opciones().modules.find((m) => m.id === id)?.name ?? null) : null;
  });

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.filtro().porPagina)));
  desde = computed(() => (this.total() === 0 ? 0 : (this.filtro().pagina - 1) * this.filtro().porPagina + 1));
  hasta = computed(() => Math.min(this.filtro().pagina * this.filtro().porPagina, this.total()));
  paginas = computed(() => {
    const total = this.totalPaginas();
    const actual = this.filtro().pagina;
    const inicio = Math.max(1, Math.min(actual - 2, total - 4));
    const fin = Math.min(total, inicio + 4);
    return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
  });

  /** details del evento abierto como filas "llave: valor". */
  filasDetalle = computed(() => {
    const d = this.seleccionado()?.details;
    return d ? Object.entries(d).map(([llave, valor]) => ({ llave, valor: Array.isArray(valor) ? valor.join(', ') : String(valor) })) : [];
  });

  constructor() {
    this.cargar();
    this.cargarEventosDelRango();
    this.api.opciones().subscribe({ next: (o) => this.opciones.set(o), error: () => undefined });
    this.api
      .listar({ ...this.soloFechas(`${hoyBogota().slice(0, 8)}01`), busqueda: 'Asignar roles', pagina: 1, porPagina: 1 })
      .subscribe({ next: (p) => this.cambiosDePermisos.set(p.total), error: () => undefined });
  }

  private desdeDe(rango: Rango): string {
    return rango === 'todo' ? '' : sumarDias(hoyBogota(), -(Number(rango) - 1));
  }

  private soloFechas(desde: string): FiltroAuditoria {
    return { busqueda: '', userId: null, moduleId: null, area: null, resultado: 'TODOS', desde, hasta: '', pagina: 1, porPagina: 1 };
  }

  private cargarEventosDelRango(): void {
    this.eventosDelRango.set(null);
    this.api
      .listar(this.soloFechas(this.desdeDe(this.rango())))
      .subscribe({ next: (p) => this.eventosDelRango.set(p.total), error: () => undefined });
  }

  escribir(valor: string): void {
    const texto = valor.slice(0, MAX_BUSQUEDA);
    this.texto.set(texto);
    if (this.espera) clearTimeout(this.espera);
    this.espera = setTimeout(() => this.cambiar({ busqueda: texto }), ESPERA_BUSQUEDA_MS);
  }

  cambiar(cambios: Partial<FiltroAuditoria>): void {
    this.filtro.update((f) => ({ ...f, pagina: 1, ...cambios }));
    this.cargar();
  }

  cambiarRango(valor: string): void {
    this.rango.set(valor as Rango);
    this.cambiarYContar({ desde: this.desdeDe(this.rango()) });
  }

  private cambiarYContar(cambios: Partial<FiltroAuditoria>): void {
    this.cambiar(cambios);
    this.cargarEventosDelRango();
  }

  quitar(clave: string): void {
    switch (clave) {
      case 'busqueda':
        this.texto.set('');
        this.cambiar({ busqueda: '' });
        break;
      case 'usuario':
        this.cambiar({ userId: null });
        break;
      case 'modulo':
        this.cambiar({ moduleId: null });
        break;
    }
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
        this.eventos.set(p.items);
        this.total.set(p.total);
        this.cargando.set(false);
      },
      error: () => {
        if (id !== this.peticion) return;
        this.cargando.set(false);
        this.error.set('No pudimos cargar el registro. Verifica que la API esté disponible e inténtalo de nuevo.');
      },
    });
  }

  /** Baja en csv lo que muestra la tabla con los filtros actuales (el back no tiene un endpoint para exportar). */
  async exportar(): Promise<void> {
    if (this.exportando()) return;
    this.exportando.set(true);
    this.errorExportar.set(null);
    try {
      const todos: EventoAuditoria[] = [];
      for (let pagina = 1; todos.length < MAX_EXPORTAR; pagina++) {
        const p = await firstValueFrom(this.api.listar({ ...this.filtro(), pagina, porPagina: POR_PAGINA_EXPORTAR }));
        todos.push(...p.items);
        if (p.items.length < POR_PAGINA_EXPORTAR || todos.length >= p.total) break;
      }
      const csv = '\uFEFF' + aCsv(todos, RESULTADOS);
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      enlace.download = `auditoria-${hoyBogota()}.csv`;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
    } catch {
      this.errorExportar.set('No pudimos exportar el registro. Inténtalo de nuevo.');
    } finally {
      this.exportando.set(false);
    }
  }

  verDetalle(e: EventoAuditoria): void {
    this.seleccionado.set({ ...e, method: '', route: '', path: '', userAgent: null, details: null });
    this.cargandoDetalle.set(true);
    this.errorDetalle.set(null);
    this.api.detalle(e.id).subscribe({
      next: (d) => {
        this.seleccionado.set(d);
        this.cargandoDetalle.set(false);
      },
      error: () => {
        this.cargandoDetalle.set(false);
        this.errorDetalle.set('No pudimos cargar el detalle de esta acción.');
      },
    });
  }

  cerrarDetalle(): void {
    this.seleccionado.set(null);
  }
}
