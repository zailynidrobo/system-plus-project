import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { AislamientoVersion, TeacherVersionView } from '../../../shared/models/teacher-version';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta, haceCuanto } from '../../../shared/utils/fechas';
import { TeacherApi } from '../teacher-api';

/** Lo que el editor deja en history.state al volver: muestra el aviso "Cambios guardados en tu versión". */
export interface AvisoGuardado {
  versionId: number;
  versionName: string;
  campos: string[];
}

// Figma HE-04-HU-02-CA-02, CA-03 · Mis versiones y aislamiento (4002:842)
@Component({
  selector: 'app-version-list',
  imports: [RouterLink, Icon],
  templateUrl: './version-list.html',
  styleUrl: './version-list.scss',
})
export class VersionList {
  private api = inject(TeacherApi);
  private auth = inject(Auth);

  versiones = signal<TeacherVersionView[]>([]);
  seleccionadaId = signal<number | null>(null);
  aislamiento = signal<AislamientoVersion | null>(null);
  cargando = signal(true);
  aviso: AvisoGuardado | null = (history.state?.guardado as AvisoGuardado | undefined) ?? null;

  fecha = fechaCorta;

  seleccionada = computed(() => this.versiones().find((v) => v.id === this.seleccionadaId()) ?? null);

  /** "Julián Ospina" */
  dueno = computed(() => {
    const partes = (this.auth.user()?.nombre ?? '').split(' ').filter(Boolean);
    return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : (partes[0] ?? '');
  });

  /** "Paola Valencia, Santiago Gómez y 5 más" */
  otrosDocentes = computed(() => {
    const d = this.aislamiento()?.docentes ?? [];
    if (d.length === 0) {
      const n = this.aislamiento()?.cantidadDocentes ?? 0;
      if (n > 0) return `${n} ${n === 1 ? 'docente tiene' : 'docentes tienen'} versiones propias`;
      return 'Ningún otro docente tiene versiones';
    }
    return d.slice(0, 2).join(', ') + (d.length > 2 ? ` y ${d.length - 2} más` : '');
  });

  constructor() {
    this.api.misVersiones().subscribe((vs) => {
      this.versiones.set(vs);
      this.cargando.set(false);
      const inicial = vs.find((v) => v.id === this.aviso?.versionId) ?? vs[0];
      if (inicial) this.seleccionar(inicial);
    });
  }

  seleccionar(v: TeacherVersionView): void {
    if (this.seleccionadaId() === v.id) return;
    this.seleccionadaId.set(v.id);
    this.aislamiento.set(null);
    this.api.aislamiento(v.id).subscribe((a) => this.aislamiento.set(a));
  }

  etiqueta(v: TeacherVersionView, key: string | null): string {
    return v.fields.find((f) => f.key === key)?.label.split(' ')[0] ?? '-';
  }

  hace(iso: string): string {
    const t = haceCuanto(iso);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  haceMin(iso: string): string {
    return haceCuanto(iso);
  }
}
