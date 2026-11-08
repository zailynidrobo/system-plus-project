import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GuideEditLock, NewGuideEditLock } from '../../../shared/models/guide-edit-lock';
import { Icon } from '../../../shared/ui/icon/icon';
import { GuideEditLockApi } from '../guide-edit-lock-api';

@Component({
  selector: 'app-guide-edit-locks',
  imports: [DatePipe, FormsModule, RouterLink, Icon],
  templateUrl: './guide-edit-locks.html',
  styleUrl: './guide-edit-locks.scss',
})
export class GuideEditLocks {
  private api = inject(GuideEditLockApi);

  locks = signal<GuideEditLock[]>([]);
  error = signal<string | null>(null);
  saving = signal(false);
  submitted = signal(false);
  dateOpen = signal<'startsAt' | 'endsAt' | null>(null);
  form: NewGuideEditLock = { name: '', startsAt: '', endsAt: '', reason: '' };
  private readonly minFechaInicio = this.toLocalDateTime(new Date());

  constructor() {
    this.load();
  }

  save(): void {
    this.error.set(null);
    this.submitted.set(true);
    const startsAt = new Date(this.form.startsAt);
    const endsAt = new Date(this.form.endsAt);
    if (
      !this.form.name.trim() ||
      !this.form.reason.trim() ||
      !this.form.startsAt ||
      !this.form.endsAt
    ) {
      this.error.set('Completa todos los campos obligatorios.');
      return;
    }
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      this.error.set('Selecciona fechas válidas para el inicio y la finalización.');
      return;
    }
    if (startsAt < new Date(this.minInicio())) {
      this.error.set('La fecha de inicio no puede estar en el pasado.');
      return;
    }
    if (startsAt >= endsAt) {
      this.error.set('La fecha de inicio debe ser anterior a la fecha de finalización.');
      return;
    }
    this.saving.set(true);
    const data: NewGuideEditLock = {
      ...this.form,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
    this.api.crear(data).subscribe({
      next: (lock) => {
        this.locks.update((items) => [...items, lock].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
        this.form = { name: '', startsAt: '', endsAt: '', reason: '' };
        this.submitted.set(false);
        this.saving.set(false);
      },
      error: (error: { code?: string; data?: { mensaje?: string } }) => {
        this.saving.set(false);
        this.error.set(
          error.code === 'GUIDE_EDIT_LOCK_OVERLAP'
            ? 'El periodo se cruza con otro bloqueo existente.'
            : error.code === 'GUIDE_EDIT_LOCK_INVALID_RANGE'
              ? 'La fecha de inicio debe ser anterior a la fecha de finalización.'
              : error.code === 'GUIDE_EDIT_LOCK_PAST'
                ? 'La fecha de inicio no puede estar en el pasado.'
              : error.code === 'SIN_PERMISO'
                ? 'Tu sesión no tiene permisos de administrador para programar cierres.'
                : error.code === 'VALIDATION_ERROR'
                  ? 'Revisa que todos los datos estén completos y que las fechas sean válidas.'
                  : error.data?.mensaje
                    ? `La API rechazó el periodo: ${error.data.mensaje}`
                    : error.code === 'ERROR_DE_SERVIDOR'
                      ? 'La API rechazó la solicitud. Reinicia el backend y revisa sus registros.'
              : 'No pudimos guardar el periodo. Verifica los datos e inténtalo de nuevo.',
        );
      },
    });
  }

  remove(lock: GuideEditLock): void {
    this.api.eliminar(lock.id).subscribe({
      next: () => this.locks.update((items) => items.filter((item) => item.id !== lock.id)),
      error: () => this.error.set('No pudimos eliminar el periodo. Inténtalo de nuevo.'),
    });
  }

  activo(lock: GuideEditLock): boolean {
    return lock.active;
  }

  estado(lock: GuideEditLock): 'Programado' | 'Activo' | 'Finalizado' {
    const ahora = Date.now();
    if (Date.parse(lock.endsAt) <= ahora) return 'Finalizado';
    if (Date.parse(lock.startsAt) > ahora) return 'Programado';
    return 'Activo';
  }

  minInicio(): string {
    return this.minFechaInicio;
  }

  minFin(): string {
    return this.form.startsAt || this.minInicio();
  }

  cerrarSelector(input: HTMLInputElement): void {
    input.blur();
    this.dateOpen.set(null);
  }

  private toLocalDateTime(date: Date): string {
    date.setSeconds(0, 0);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
  }

  private load(): void {
    this.api.listar().subscribe({
      next: (locks) => {
        this.locks.set(locks);
        this.error.set(null);
      },
      error: (error: { code?: string; data?: { mensaje?: string } }) =>
        this.error.set(
          error.code === 'SIN_PERMISO'
            ? 'Tu sesión no tiene permisos de administrador para consultar los cierres.'
            : error.code === 'ERROR_DE_SERVIDOR'
              ? error.data?.mensaje
                ? `La API no pudo cargar los cierres: ${error.data.mensaje}`
                : 'La API no está disponible o necesita reiniciarse para cargar los cierres.'
              : 'No pudimos cargar los periodos de bloqueo. Inténtalo de nuevo.',
        ),
    });
  }
}
