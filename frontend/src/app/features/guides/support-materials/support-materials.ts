import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Auth } from '../../../core/auth/auth';
import { ApiError } from '../../../shared/models/api-error';
import { SupportMaterial } from '../../../shared/models/support-material';
import { Icon } from '../../../shared/ui/icon/icon';
import { SupportMaterialApi } from './support-material-api';

const ERRORES: Record<string, string> = {
  TIPO_NO_PERMITIDO: 'Solo se permiten archivos PDF o DOCX.',
  ARCHIVO_MUY_GRANDE: 'El archivo no puede superar los 10 MB.',
  SIN_PERMISO: 'No tienes permiso para hacer esta acción.',
  NOT_FOUND: 'El material ya no existe.',
};

/**
 * Materiales de apoyo de una guía: todos los que ven la guía los descargan; la coordinación
 * y el docente autorizado pueden subir. Se borra lo propio (la coordinación, cualquiera).
 */
@Component({
  selector: 'app-support-materials',
  imports: [Icon],
  templateUrl: './support-materials.html',
  styleUrl: './support-materials.scss',
})
export class SupportMaterials implements OnInit {
  private api = inject(SupportMaterialApi);
  private auth = inject(Auth);

  guideId = input.required<number>();
  /** Si el rol puede subir archivos a esta guía. */
  puedeSubir = input(false);

  materiales = signal<SupportMaterial[]>([]);
  cargando = signal(true);
  subiendo = signal(false);
  error = signal('');

  private esCoordinador = computed(() => this.auth.user()?.rol === 'COORDINADOR');
  private miId = computed(() => {
    const u = this.auth.user();
    return u ? (u.keycloakId ?? String(u.id)) : '';
  });

  ngOnInit(): void {
    this.cargar();
  }

  puedeBorrar(m: SupportMaterial): boolean {
    if (!this.puedeSubir()) return false;
    return this.esCoordinador() || m.uploadedBy?.id === this.miId();
  }

  elegir(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    this.error.set('');
    this.subiendo.set(true);
    this.api.subir(this.guideId(), archivo).subscribe({
      next: (m) => {
        this.materiales.update((lista) => [...lista, m]);
        this.subiendo.set(false);
      },
      error: (e: unknown) => {
        this.subiendo.set(false);
        this.error.set(this.mensaje(e, 'No pudimos subir el archivo. Inténtalo de nuevo.'));
      },
    });
  }

  descargar(m: SupportMaterial): void {
    this.error.set('');
    this.api.descargar(this.guideId(), m.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = m.fileName;
        enlace.click();
        URL.revokeObjectURL(url);
      },
      error: (e: unknown) => this.error.set(this.mensaje(e, 'No pudimos descargar el archivo.')),
    });
  }

  eliminar(m: SupportMaterial): void {
    this.error.set('');
    this.api.eliminar(this.guideId(), m.id).subscribe({
      next: () => this.materiales.update((lista) => lista.filter((x) => x.id !== m.id)),
      error: (e: unknown) => this.error.set(this.mensaje(e, 'No pudimos eliminar el archivo.')),
    });
  }

  tamano(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  private cargar(): void {
    this.api.listar(this.guideId()).subscribe({
      next: (lista) => {
        this.materiales.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No pudimos cargar los materiales de apoyo.');
      },
    });
  }

  private mensaje(e: unknown, porDefecto: string): string {
    return e instanceof ApiError ? (ERRORES[e.code] ?? porDefecto) : porDefecto;
  }
}
