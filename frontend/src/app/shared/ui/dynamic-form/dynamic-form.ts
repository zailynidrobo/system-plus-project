import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GuideContent, GuideField, GuideValue } from '../../models/guide-field';
import { Icon } from '../icon/icon';

export interface CambioCampo {
  key: string;
  value: GuideValue;
}

/**
 * Formulario generado a partir de la estructura configurada (HE-03-HU-04): no hay texto libre
 * fuera de los campos. Las listas de hasta 3 opciones se muestran como botones (Figma).
 */
@Component({
  selector: 'app-dynamic-form',
  imports: [ReactiveFormsModule, NgTemplateOutlet, Icon],
  templateUrl: './dynamic-form.html',
})
export class DynamicForm {
  fields = input.required<GuideField[]>();
  valores = input<GuideContent>({});
  /** Contenido guardado: los campos que cambien muestran la etiqueta "Modificado". */
  original = input<GuideContent | null>(null);
  /** Si se indica, los primeros campos cortos van en una rejilla y el resto bajo este título. */
  seccionContenido = input<string | null>(null);
  /** Campos que no se pueden editar (p. ej. los no editables por el docente en HE-04). */
  bloqueados = input<string[]>([]);

  cambio = output<GuideContent>();
  campo = output<CambioCampo>();

  form = signal(new FormGroup<Record<string, FormControl<GuideValue>>>({}));
  private valoresActuales = signal<GuideContent>({});
  private destroyRef = inject(DestroyRef);
  private subs: Subscription[] = [];

  /** Campos cortos al inicio (rejilla) y el resto (contenido pedagógico). */
  grupos = computed(() => {
    const fields = this.fields();
    if (!this.seccionContenido()) return { cortos: [] as GuideField[], resto: fields };
    const corte = fields.findIndex((f) => f.type === 'textarea');
    const fin = corte === -1 ? fields.length : corte;
    return { cortos: fields.slice(0, fin), resto: fields.slice(fin) };
  });

  constructor() {
    // Se reconstruye solo cuando cambia la estructura; los valores se toman en ese momento
    effect(() => {
      const fields = this.fields();
      untracked(() => this.construir(fields, this.valores()));
    });
    this.destroyRef.onDestroy(() => this.subs.forEach((s) => s.unsubscribe()));
  }

  /** Marca todos los campos y devuelve si el formulario es válido. */
  validar(): boolean {
    this.form().markAllAsTouched();
    return this.form().valid;
  }

  valor(): GuideContent {
    return this.form().getRawValue();
  }

  /** Vuelve a cargar valores sin reconstruir el formulario (p. ej. "Descartar cambios"). */
  restablecer(content: GuideContent): void {
    this.form().reset(content);
  }

  elegir(f: GuideField, opcion: string): void {
    const control = this.form().controls[f.key];
    if (control.disabled) return;
    control.setValue(control.value === opcion ? null : opcion);
    control.markAsTouched();
  }

  modificado(key: string): boolean {
    const original = this.original();
    if (!original) return false;
    const actual = this.valoresActuales()[key] ?? null;
    const antes = original[key] ?? null;
    return String(actual ?? '').trim() !== String(antes ?? '').trim();
  }

  error(key: string): boolean {
    const c = this.form().controls[key];
    return !!c && c.touched && c.invalid;
  }

  longitud(key: string): number {
    return String(this.valoresActuales()[key] ?? '').length;
  }

  private construir(fields: GuideField[], valores: GuideContent): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];
    const bloqueados = new Set(untracked(this.bloqueados));
    const controles: Record<string, FormControl<GuideValue>> = {};
    for (const f of fields) {
      const validadores = f.required ? [Validators.required, Validators.pattern(/\S/)] : [];
      if (f.maxLength) validadores.push(Validators.maxLength(f.maxLength));
      controles[f.key] = new FormControl<GuideValue>(
        { value: valores[f.key] ?? null, disabled: bloqueados.has(f.key) },
        validadores,
      );
    }
    const form = new FormGroup(controles);
    this.form.set(form);
    this.valoresActuales.set(form.getRawValue());

    this.subs.push(form.valueChanges.subscribe(() => {
      const v = form.getRawValue();
      this.valoresActuales.set(v);
      this.cambio.emit(v);
    }));
    for (const f of fields) {
      this.subs.push(controles[f.key].valueChanges.subscribe((value) => this.campo.emit({ key: f.key, value })));
    }
  }
}
