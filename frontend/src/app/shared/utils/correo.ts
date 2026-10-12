import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Formato de correo: algo@dominio.tld. Se acepta cualquier dominio. */
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function esCorreoValido(valor: string): boolean {
  return FORMATO_CORREO.test(valor.trim().toLowerCase());
}

/** Validador de formulario: { formato: true } si el correo no tiene un formato válido. */
export function validarCorreo(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  if (!valor) return null; // "required" se encarga del vacío
  return esCorreoValido(valor) ? null : { formato: true };
}
