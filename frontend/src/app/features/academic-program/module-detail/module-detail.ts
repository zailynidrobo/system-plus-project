import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { MODULE_STATUS_LABELS, ModuleView } from '../../../shared/models/academic-module';
import { CompetencyView } from '../../../shared/models/competency';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/confirm-modal';
import { Icon } from '../../../shared/ui/icon/icon';
import { cuando, iconoModulo, pillEstadoModulo } from '../../../shared/utils/modulos';
import { CompetencyApi } from '../competency-api';
import { ModuleApi } from '../module-api';
import { DocenteAsignable, TeacherAssignmentApi } from '../teacher-assignment-api';

// Figma HE-02 · PanelCoordinador-Competencias (204:3269)
@Component({
  selector: 'app-module-detail',
  imports: [RouterLink, Icon, ConfirmModal],
  templateUrl: './module-detail.html',
})
export class ModuleDetail {
  private moduleApi = inject(ModuleApi);
  private competencyApi = inject(CompetencyApi);
  private asignacionApi = inject(TeacherAssignmentApi);
  id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  modulo = signal<ModuleView | null>(null);
  competencias = signal<CompetencyView[]>([]);
  cargando = signal(true);

  accion = signal<'rehabilitar' | 'registrar' | null>(null);
  procesando = signal(false);

  // Asignación de docentes (HE-04): solo contra el backend; con datos simulados no hay a quién asignar.
  conAsignacion = environment.apiAcademico === 'http';
  docentes = signal<DocenteAsignable[]>([]);
  asignadosIds = signal<string[]>([]);
  seleccion = signal('');
  asignando = signal(false);
  errorAsignacion = signal('');
  asignados = computed(() => this.docentes().filter((d) => this.asignadosIds().includes(d.id)));
  disponibles = computed(() => this.docentes().filter((d) => !this.asignadosIds().includes(d.id)));

  labels = MODULE_STATUS_LABELS;
  pill = pillEstadoModulo;
  icono = iconoModulo;
  cuando = cuando;

  constructor() {
    this.cargar();
    if (this.conAsignacion) this.cargarAsignacion();
  }

  asignar(): void {
    const teacherId = this.seleccion();
    if (!teacherId || this.asignando()) return;
    this.cambiarAsignacion(this.asignacionApi.asignar(this.id, teacherId));
  }

  quitar(teacherId: string): void {
    if (this.asignando()) return;
    this.cambiarAsignacion(this.asignacionApi.quitar(this.id, teacherId));
  }

  private cambiarAsignacion(peticion: ReturnType<TeacherAssignmentApi['asignar']>): void {
    this.asignando.set(true);
    this.errorAsignacion.set('');
    peticion.subscribe({
      next: () => {
        this.asignando.set(false);
        this.seleccion.set('');
        this.cargarAsignacion();
      },
      error: () => {
        this.asignando.set(false);
        this.errorAsignacion.set('No se pudo actualizar la asignación. Intenta de nuevo.');
      },
    });
  }

  private cargarAsignacion(): void {
    this.asignacionApi.docentes().subscribe({
      next: (d) => this.docentes.set(d),
      error: () => this.errorAsignacion.set('No se pudo cargar la lista de docentes.'),
    });
    this.asignacionApi.asignados(this.id).subscribe({
      next: (ids) => this.asignadosIds.set(ids),
      error: () => this.errorAsignacion.set('No se pudo cargar los docentes asignados.'),
    });
  }

  confirmarAccion(): void {
    const peticion = this.accion() === 'rehabilitar' ? this.moduleApi.rehabilitar(this.id) : this.moduleApi.registrar(this.id);
    this.procesando.set(true);
    peticion.subscribe({
      next: () => this.terminar(),
      error: () => this.terminar(),
    });
  }

  private terminar(): void {
    this.procesando.set(false);
    this.accion.set(null);
    this.cargar();
  }

  private cargar(): void {
    this.moduleApi.obtener(this.id).subscribe({
      next: (m) => {
        this.modulo.set(m);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
    this.competencyApi.listar(this.id).subscribe((c) => this.competencias.set(c));
  }
}
