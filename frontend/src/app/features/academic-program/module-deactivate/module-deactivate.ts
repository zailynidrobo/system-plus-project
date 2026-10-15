import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ModuleView } from '../../../shared/models/academic-module';
import { Icon } from '../../../shared/ui/icon/icon';
import { iconoModulo } from '../../../shared/utils/modulos';
import { ModuleApi } from '../module-api';

// Figma HE-02-HU-03 · Inhabilitar módulo (204:3450). El motivo opcional no está en el
// frame: lo pide la HU y lo acepta el backend (DeactivateCurricularModuleDto).
@Component({
  selector: 'app-module-deactivate',
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './module-deactivate.html',
})
export class ModuleDeactivate {
  private api = inject(ModuleApi);
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  modulo = signal<ModuleView | null>(null);
  cargando = signal(true);
  procesando = signal(false);
  hecho = signal(false);
  error = signal(false);
  motivo = '';

  icono = iconoModulo;

  constructor() {
    this.api.obtener(this.id).subscribe({
      next: (m) => {
        this.modulo.set(m);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  confirmar(): void {
    this.procesando.set(true);
    this.error.set(false);
    this.api.inhabilitar(this.id, this.motivo).subscribe({
      next: (m) => {
        this.modulo.set(m);
        this.hecho.set(true);
        this.procesando.set(false);
      },
      error: () => {
        this.procesando.set(false);
        this.error.set(true);
      },
    });
  }
}
