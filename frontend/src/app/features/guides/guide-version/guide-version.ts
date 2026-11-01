import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Miga } from '../../../core/layout/miga';
import { ApiError } from '../../../shared/models/api-error';
import { GuideVersionDetail } from '../../../shared/models/guide-version';
import { Icon } from '../../../shared/ui/icon/icon';
import { GuideContentView } from '../../../shared/ui/guide-content/guide-content';
import { fechaCorta } from '../../../shared/utils/fechas';
import { GuideApi } from '../guide-api';

// figma he-07-hu-02 ver una version
@Component({
  selector: 'app-guide-version',
  imports: [RouterLink, Icon, GuideContentView],
  templateUrl: './guide-version.html',
  styleUrl: './guide-version.scss',
})
export class GuideVersion {
  private api = inject(GuideApi);
  private miga = inject(Miga);
  readonly id: number;
  readonly version: string;

  actual = signal<GuideVersionDetail | null>(null);
  cargando = signal(true);
  exportando = signal<'pdf' | 'docx' | null>(null);
  error = signal<string | null>(null);

  fecha = fechaCorta;

  constructor() {
    const params = inject(ActivatedRoute).snapshot.paramMap;
    this.id = Number(params.get('id'));
    this.version = params.get('version') ?? '';
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.version(this.id, this.version).subscribe({
      next: (detalle) => {
        this.actual.set(detalle);
        this.miga.detalle.set(`Versión ${detalle.version.replace('v', '')}`);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        // si no existe se muestra "la version que buscas no existe", no el error de la api
        if (!(e instanceof ApiError && e.code === 'NOT_FOUND')) {
          this.error.set(
            'No pudimos cargar esta versión. Verifica que la API esté disponible e inténtalo de nuevo.',
          );
        }
      },
    });
  }

  exportar(formato: 'pdf' | 'docx'): void {
    this.exportarVersion(this.version, formato);
  }

  private exportarVersion(version: string, formato: 'pdf' | 'docx'): void {
    if (this.exportando()) return;
    this.exportando.set(formato);
    this.api.exportarVersion(this.id, version, formato).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (formato === 'pdf') {
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.target = '_blank';
          enlace.rel = 'noopener noreferrer';
          enlace.click();
        } else {
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `guia-${version}.docx`;
          enlace.click();
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.exportando.set(null);
      },
      error: () => {
        this.exportando.set(null);
        this.error.set(
          'No pudimos generar el documento. Verifica que la API y LibreOffice estén disponibles.',
        );
      },
    });
  }

  titulo(v: GuideVersionDetail): string {
    return `${v.version.replace('v', '')}`;
  }
}
