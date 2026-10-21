import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../shared/models/api-error';
import { ModuleView } from '../../../shared/models/academic-module';
import { CompetencyView } from '../../../shared/models/competency';
import { FIELD_TYPE_ICONS, FIELD_TYPE_LABELS, FieldConfig, GuideField, GuideFieldType, describirCampo } from '../../../shared/models/guide-field';
import { DynamicForm } from '../../../shared/ui/dynamic-form/dynamic-form';
import { Icon } from '../../../shared/ui/icon/icon';
import { CompetencyApi } from '../../academic-program/competency-api';
import { ModuleApi } from '../../academic-program/module-api';
import { FieldConfigApi, ImpactoEstructura, OrigenEstructura, claveDesdeEtiqueta } from '../field-config-api';

const ERRORES: Record<string, string> = {
  FIELD_LABEL_REQUIRED: 'Todos los campos necesitan un nombre.',
  FIELD_KEY_DUPLICATED: 'Hay dos campos con la misma clave.',
  SELECT_OPTIONS_REQUIRED: 'Las listas necesitan al menos dos opciones.',
  FIELDS_REQUIRED: 'La estructura necesita al menos un campo.',
};

// Figma HE-03-HU-04: editor de campos (2027:1559) y aviso de impacto (2027:1915)
@Component({
  selector: 'app-field-config',
  imports: [RouterLink, Icon, DynamicForm],
  templateUrl: './field-config.html',
})
export class FieldConfigPage {
  private api = inject(FieldConfigApi);
  private moduleApi = inject(ModuleApi);
  private competencyApi = inject(CompetencyApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  tipos = Object.keys(FIELD_TYPE_LABELS) as GuideFieldType[];
  tipoLabel = FIELD_TYPE_LABELS;
  tipoIcono = FIELD_TYPE_ICONS;
  describir = describirCampo;

  modulos = signal<ModuleView[]>([]);
  moduloId = signal<number | null>(null);
  competencias = signal<CompetencyView[]>([]);
  competenciaId = signal<number | null>(null);

  estructura = signal<FieldConfig | null>(null);
  origen = signal<OrigenEstructura>('modulo');
  campos = signal<GuideField[]>([]);
  nuevos = signal<Set<string>>(new Set());
  seleccion = signal<string | null>(null);
  editado = signal<GuideField | null>(null);
  opcionesTexto = signal('');
  arrastrando = signal<number | null>(null);

  impacto = signal<ImpactoEstructura | null>(null);
  vistaPrevia = signal(false);
  guardando = signal(false);
  guardada = signal<FieldConfig | null>(null);
  error = signal<string | null>(null);

  modulo = computed(() => this.modulos().find((m) => m.id === this.moduloId()) ?? null);

  hayCambios = computed(() => JSON.stringify(this.campos()) !== JSON.stringify(this.estructura()?.fields ?? []));

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    const pedido = Number(q.get('modulo')) || null;
    const competencia = Number(q.get('competencia')) || null;
    this.moduleApi.listar({ busqueda: '', estado: 'TODOS', orden: 'codigo' }).subscribe((m) => {
      const disponibles = m.filter((x) => x.status !== 'inactive');
      this.modulos.set(disponibles);
      const inicial = disponibles.find((x) => x.id === pedido) ?? disponibles.find((x) => x.code === 'TS-MOD-02') ?? disponibles[0];
      if (inicial) this.elegirModulo(inicial.id, competencia);
    });
  }

  elegirModulo(id: number, competencia: number | null = null): void {
    this.moduloId.set(id);
    this.competenciaId.set(competencia);
    this.competencyApi.listar(id).subscribe((c) => this.competencias.set(c));
    this.cargar();
  }

  elegirCompetencia(valor: string): void {
    this.competenciaId.set(valor ? Number(valor) : null);
    this.cargar();
  }

  seleccionar(f: GuideField): void {
    this.seleccion.set(f.key);
    this.editado.set(structuredClone(f));
    this.opcionesTexto.set((f.options ?? []).join('\n'));
    this.error.set(null);
  }

  cambiarEditado(cambios: Partial<GuideField>): void {
    this.editado.update((e) => (e ? { ...e, ...cambios } : e));
  }

  /** "Aplicar al campo": lleva las propiedades del panel a la lista (aún sin guardar la estructura). */
  aplicar(): void {
    const e = this.editado();
    const key = this.seleccion();
    if (!e || !key) return;
    const label = e.label.trim();
    if (!label) {
      this.error.set('El campo necesita un nombre.');
      return;
    }
    const options = e.type === 'select' ? this.opcionesTexto().split('\n').map((o) => o.trim()).filter(Boolean) : undefined;
    if (e.type === 'select' && (options?.length ?? 0) < 2) {
      this.error.set('Una lista necesita al menos dos opciones (una por línea).');
      return;
    }
    // Los campos nuevos toman la clave de su nombre; los existentes la conservan para no perder valores
    const esNuevo = this.nuevos().has(key);
    const nuevaKey = esNuevo ? claveDesdeEtiqueta(label, this.campos().filter((f) => f.key !== key).map((f) => f.key)) : key;
    const actualizado: GuideField = {
      ...e,
      key: nuevaKey,
      label,
      options,
      maxLength: e.type === 'text' || e.type === 'textarea' ? e.maxLength || undefined : undefined,
      help: e.help?.trim() || undefined,
    };
    this.campos.update((lista) => lista.map((f) => (f.key === key ? actualizado : f)));
    if (esNuevo && nuevaKey !== key) {
      this.nuevos.update((s) => new Set([...s].map((k) => (k === key ? nuevaKey : k))));
    }
    this.seleccion.set(nuevaKey);
    this.editado.set(structuredClone(actualizado));
    this.error.set(null);
  }

  eliminar(): void {
    const key = this.seleccion();
    if (!key) return;
    this.campos.update((lista) => lista.filter((f) => f.key !== key));
    this.seleccion.set(null);
    this.editado.set(null);
  }

  agregar(): void {
    const key = claveDesdeEtiqueta('Nuevo campo', this.campos().map((f) => f.key));
    const nuevo: GuideField = { key, label: 'Nuevo campo', type: 'text', required: false, teacherEditable: true };
    this.campos.update((lista) => [...lista, nuevo]);
    this.nuevos.update((s) => new Set(s).add(key));
    this.seleccionar(nuevo);
  }

  mover(desde: number, hasta: number): void {
    if (hasta < 0 || hasta >= this.campos().length || desde === hasta) return;
    this.campos.update((lista) => {
      const copia = [...lista];
      const [campo] = copia.splice(desde, 1);
      copia.splice(hasta, 0, campo);
      return copia;
    });
  }

  soltar(indice: number): void {
    const desde = this.arrastrando();
    this.arrastrando.set(null);
    if (desde !== null) this.mover(desde, indice);
  }

  /** "Guardar estructura": si hay guías alcanzadas, primero el aviso de impacto. */
  guardar(): void {
    const id = this.moduloId();
    if (!id || !this.hayCambios()) return;
    this.error.set(null);
    this.api.impacto(id, this.competenciaId(), this.campos()).subscribe((imp) => {
      if (imp.publicadas + imp.borradores > 0) this.impacto.set(imp);
      else this.confirmarGuardar();
    });
  }

  confirmarGuardar(): void {
    const id = this.moduloId();
    if (!id) return;
    this.guardando.set(true);
    this.api.guardar(id, this.competenciaId(), this.campos()).subscribe({
      next: (config) => {
        this.guardando.set(false);
        this.impacto.set(null);
        this.guardada.set(config);
        this.cargar();
      },
      error: (err: ApiError) => {
        this.guardando.set(false);
        this.impacto.set(null);
        this.error.set(ERRORES[err.code] ?? 'No pudimos guardar la estructura. Inténtalo de nuevo.');
      },
    });
  }

  crearGuia(): void {
    this.router.navigate(['/guias/nueva'], { queryParams: { modulo: this.moduloId() } });
  }

  private cargar(): void {
    const id = this.moduloId();
    if (!id) return;
    this.api.obtener(id, this.competenciaId()).subscribe((e) => {
      this.estructura.set(e.config);
      this.origen.set(e.origen);
      this.campos.set(structuredClone(e.config.fields));
      this.nuevos.set(new Set());
      this.seleccion.set(null);
      this.editado.set(null);
    });
  }
}
