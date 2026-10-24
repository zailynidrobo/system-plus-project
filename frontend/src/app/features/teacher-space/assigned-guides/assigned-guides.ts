import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta } from '../../../shared/utils/fechas';
import { iconoModulo } from '../../../shared/utils/modulos';
import { FiltroGuiasDocente, GuiasAsignadas, TeacherApi } from '../teacher-api';

// Figma HE-04-HU-01-CA-01 · Guías asignadas (4002:26)
@Component({
  selector: 'app-assigned-guides',
  imports: [RouterLink, Icon],
  templateUrl: './assigned-guides.html',
})
export class AssignedGuides {
  private api = inject(TeacherApi);

  modulos = toSignal(this.api.misModulos(), { initialValue: [] });
  filtro = signal<FiltroGuiasDocente>({ busqueda: '', moduleId: null });
  datos = signal<GuiasAsignadas | null>(null);
  cargando = signal(true);

  fecha = fechaCorta;
  icono = iconoModulo;

  /** "Redes y conectividad, Fundamentos de programación..." (máximo tres nombres). */
  otrosModulos = computed(() => {
    const nombres = this.datos()?.ocultas.modulos ?? [];
    return nombres.slice(0, 3).join(', ') + (nombres.length > 3 ? '...' : '');
  });

  constructor() {
    this.cargar();
  }

  cambiar(cambios: Partial<FiltroGuiasDocente>): void {
    this.filtro.update((f) => ({ ...f, ...cambios }));
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.api.guiasAsignadas(this.filtro()).subscribe((d) => {
      this.datos.set(d);
      this.cargando.set(false);
    });
  }
}
