import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MODULE_STATUS_LABELS, ModuleView } from '../../../shared/models/academic-module';
import { CompetencyView } from '../../../shared/models/competency';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/confirm-modal';
import { Icon } from '../../../shared/ui/icon/icon';
import { cuando, iconoModulo, pillEstadoModulo } from '../../../shared/utils/modulos';
import { CompetencyApi } from '../competency-api';
import { ModuleApi } from '../module-api';

// Figma HE-02 · PanelCoordinador-Competencias (204:3269)
@Component({
  selector: 'app-module-detail',
  imports: [RouterLink, Icon, ConfirmModal],
  templateUrl: './module-detail.html',
})
export class ModuleDetail {
  private moduleApi = inject(ModuleApi);
  private competencyApi = inject(CompetencyApi);
  id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  modulo = signal<ModuleView | null>(null);
  competencias = signal<CompetencyView[]>([]);
  cargando = signal(true);

  accion = signal<'rehabilitar' | 'registrar' | null>(null);
  procesando = signal(false);

  labels = MODULE_STATUS_LABELS;
  pill = pillEstadoModulo;
  icono = iconoModulo;
  cuando = cuando;

  constructor() {
    this.cargar();
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
