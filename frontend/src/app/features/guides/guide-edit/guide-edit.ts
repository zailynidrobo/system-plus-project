import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { Miga } from '../../../core/layout/miga';
import { CompetencyView } from '../../../shared/models/competency';
import { GuideEvent, GuideView } from '../../../shared/models/guide';
import { GuideContent, camposFaltantes } from '../../../shared/models/guide-field';
import { User } from '../../../shared/models/user';
import { DynamicForm } from '../../../shared/ui/dynamic-form/dynamic-form';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta, hora } from '../../../shared/utils/fechas';
import { cuando } from '../../../shared/utils/modulos';
import { CompetencyApi } from '../../academic-program/competency-api';
import { GuideApi } from '../guide-api';
import { PublishModal } from '../publish-modal/publish-modal';

// Figma HE-03: editar borrador (2027:959), confirmar publicación (2027:1373) y publicada con éxito (2027:1176)
@Component({
  selector: 'app-guide-edit',
  imports: [RouterLink, Icon, DynamicForm, PublishModal],
  templateUrl: './guide-edit.html',
})
export class GuideEdit {
  private api = inject(GuideApi);
  private competencyApi = inject(CompetencyApi);
  private miga = inject(Miga);
  private route = inject(ActivatedRoute);
  private formulario = viewChild(DynamicForm);
  private id = Number(this.route.snapshot.paramMap.get('id'));

  guia = signal<GuideView | null>(null);
  competencias = signal<CompetencyView[]>([]);
  competenciaId = signal<number | null>(null);
  contenido = signal<GuideContent>({});
  historial = signal<GuideEvent[]>([]);
  docentes = signal<User[]>([]);
  publicadasTotal = signal(0);
  cargando = signal(true);
  guardando = signal(false);
  guardado = signal(false);
  error = signal<string | null>(null);
  publicando = signal(false);
  modalPublicar = signal(false);
  publicada = signal<GuideView | null>(null);

  fecha = fechaCorta;
  hora = hora;
  cuando = cuando;

  hayCambios = computed(() => {
    const g = this.guia();
    if (!g) return false;
    if (this.competenciaId() !== g.competencyId) return true;
    const c = this.contenido();
    return g.fields.some((f) => String(c[f.key] ?? '').trim() !== String(g.content[f.key] ?? '').trim());
  });

  constructor() {
    const abrirPublicar = this.route.snapshot.queryParamMap.has('publicar');
    this.api.obtener(this.id).subscribe({
      next: (g) => {
        this.mostrar(g);
        this.cargando.set(false);
        this.competencyApi.listar(g.moduleId).subscribe((c) => this.competencias.set(c));
        this.api.docentesDelModulo(g.moduleId).subscribe((d) => this.docentes.set(d));
        if (abrirPublicar && g.status === 'Borrador') this.abrirPublicar();
      },
      error: () => this.cargando.set(false),
    });
    this.api.resumen().subscribe((r) => this.publicadasTotal.set(r.publicadas));
    this.cargarHistorial();
  }

  descartar(): void {
    const g = this.guia();
    if (!g) return;
    this.competenciaId.set(g.competencyId);
    this.formulario()?.restablecer(g.content);
  }

  guardar(): void {
    this.guardarCambios().subscribe();
  }

  /** "Publicar…": guarda los cambios pendientes y abre la confirmación explícita. */
  abrirPublicar(): void {
    this.guardarCambios().subscribe((ok) => {
      const g = this.guia();
      if (!ok || !g) return;
      const faltan = camposFaltantes(g.fields, g.content);
      if (faltan.length) {
        this.formulario()?.validar();
        this.error.set(`Para publicar completa: ${faltan.map((f) => f.label).join(', ')}.`);
        return;
      }
      this.modalPublicar.set(true);
      this.miga.detalle.set('Publicar guía');
    });
  }

  cerrarPublicar(): void {
    this.modalPublicar.set(false);
    this.miga.detalle.set(null);
  }

  publicar(): void {
    this.publicando.set(true);
    this.api.publicar(this.id).subscribe({
      next: (g) => {
        this.publicando.set(false);
        this.modalPublicar.set(false);
        this.publicada.set(g);
        this.miga.detalle.set('Publicación completada');
      },
      error: () => {
        this.publicando.set(false);
        this.modalPublicar.set(false);
        this.error.set('No pudimos publicar la guía. Verifica que todos los campos obligatorios estén diligenciados.');
      },
    });
  }

  iniciales(nombre: string): string {
    const p = nombre.split(' ').filter(Boolean);
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  /** Guarda si hay cambios; emite true si todo quedó guardado y válido. */
  private guardarCambios(): Observable<boolean> {
    this.error.set(null);
    if (!this.hayCambios()) return of(true);
    const form = this.formulario();
    if (!form || !form.validar() || !this.competenciaId()) {
      this.error.set('Completa los campos obligatorios antes de continuar.');
      return of(false);
    }

    this.guardando.set(true);
    return new Observable<boolean>((sub) => {
      this.api.actualizar(this.id, { competencyId: this.competenciaId()!, content: form.valor() }).subscribe({
        next: (g) => {
          this.guardando.set(false);
          this.guardado.set(true);
          this.mostrar(g);
          this.cargarHistorial();
          sub.next(true);
          sub.complete();
        },
        error: () => {
          this.guardando.set(false);
          this.error.set('No pudimos guardar los cambios. Inténtalo de nuevo en unos minutos.');
          sub.next(false);
          sub.complete();
        },
      });
    });
  }

  private mostrar(g: GuideView): void {
    this.guia.set(g);
    this.competenciaId.set(g.competencyId);
    this.contenido.set(g.content);
  }

  private cargarHistorial(): void {
    this.api.historial(this.id).subscribe({ next: (h) => this.historial.set(h), error: () => {} });
  }
}
