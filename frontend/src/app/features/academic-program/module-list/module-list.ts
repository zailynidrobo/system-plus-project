import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MODULE_STATUS_LABELS, ModuleStatus, ModuleView } from '../../../shared/models/academic-module';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/confirm-modal';
import { Icon } from '../../../shared/ui/icon/icon';
import { pillEstadoModulo } from '../../../shared/utils/modulos';
import { FiltroModulos, ModuleApi, ResumenModulos } from '../module-api';

// Figma HE-02 · PanelCoordinador (204:4077)
@Component({
  selector: 'app-module-list',
  imports: [RouterLink, Icon, ConfirmModal],
  templateUrl: './module-list.html',
  host: { '(document:keydown.control.k)': 'enfocarBusqueda($event)', '(document:keydown.meta.k)': 'enfocarBusqueda($event)' },
})
export class ModuleList {
  private api = inject(ModuleApi);
  private busquedaInput = viewChild<ElementRef<HTMLInputElement>>('busquedaInput');

  labels = MODULE_STATUS_LABELS;
  pill = pillEstadoModulo;
  estados: ModuleStatus[] = ['active', 'draft', 'inactive'];

  filtro = signal<FiltroModulos>({ busqueda: '', estado: 'TODOS', orden: 'nombre' });
  modulos = signal<ModuleView[]>([]);
  resumen = signal<ResumenModulos | null>(null);
  cargando = signal(true);
  error = signal(false);

  // Acciones sin frame propio (rehabilitar / registrar borrador) se confirman en un modal
  accion = signal<{ tipo: 'rehabilitar' | 'registrar'; modulo: ModuleView } | null>(null);
  procesando = signal(false);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.api.listar(this.filtro()).subscribe({
      next: (m) => {
        this.modulos.set(m);
        this.cargando.set(false);
      },
      error: () => {
        this.modulos.set([]);
        this.error.set(true);
        this.cargando.set(false);
      },
    });
    this.api.resumen().subscribe({ next: (r) => this.resumen.set(r), error: () => this.resumen.set(null) });
  }

  cambiar(cambios: Partial<FiltroModulos>): void {
    this.filtro.update((f) => ({ ...f, ...cambios }));
    this.cargar();
  }

  verTodo(): void {
    this.filtro.set({ busqueda: '', estado: 'TODOS', orden: 'codigo' });
    this.cargar();
  }

  confirmarAccion(): void {
    const a = this.accion();
    if (!a) return;
    this.procesando.set(true);
    const peticion = a.tipo === 'rehabilitar' ? this.api.rehabilitar(a.modulo.id) : this.api.registrar(a.modulo.id);
    peticion.subscribe({
      next: () => this.terminarAccion(),
      error: () => this.terminarAccion(),
    });
  }

  enfocarBusqueda(e: Event): void {
    e.preventDefault();
    this.busquedaInput()?.nativeElement.focus();
  }

  private terminarAccion(): void {
    this.procesando.set(false);
    this.accion.set(null);
    this.cargar();
  }
}
