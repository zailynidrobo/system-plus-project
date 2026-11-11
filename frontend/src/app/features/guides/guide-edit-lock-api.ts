import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { ApiError } from '../../shared/models/api-error';
import { GuideEditLock, NewGuideEditLock } from '../../shared/models/guide-edit-lock';

@Injectable({ providedIn: 'root' })
export class GuideEditLockApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);

  listar(): Observable<GuideEditLock[]> {
    return simular(this.ms, () => this.db.bloqueosEdicion.map((lock) => this.map(lock)));
  }

  crear(data: NewGuideEditLock): Observable<GuideEditLock> {
    return simular(this.ms, () => {
      const startsAt = new Date(data.startsAt);
      const endsAt = new Date(data.endsAt);
      const ahora = new Date();
      ahora.setSeconds(0, 0);
      if (startsAt < ahora) throw new ApiError('GUIDE_EDIT_LOCK_PAST');
      if (startsAt >= endsAt) throw new ApiError('GUIDE_EDIT_LOCK_INVALID_RANGE');
      if (
        this.db.bloqueosEdicion.some(
          (lock) => new Date(lock.startsAt) < endsAt && new Date(lock.endsAt) > startsAt,
        )
      ) {
        throw new ApiError('GUIDE_EDIT_LOCK_OVERLAP');
      }
      const lock = {
        id: crypto.randomUUID(),
        ...data,
        name: data.name.trim(),
        reason: data.reason.trim(),
        createdBy: {
          id: String(this.auth.user()?.id ?? ''),
          name: this.auth.user()?.nombre ?? 'Administrador',
        },
        createdAt: new Date().toISOString(),
      };
      this.db.bloqueosEdicion = [...this.db.bloqueosEdicion, lock];
      return this.map(lock);
    });
  }

  eliminar(id: string): Observable<void> {
    return simular(this.ms, () => {
      if (!this.db.bloqueosEdicion.some((lock) => lock.id === id)) {
        throw new ApiError('GUIDE_EDIT_LOCK_NOT_FOUND');
      }
      this.db.bloqueosEdicion = this.db.bloqueosEdicion.filter((lock) => lock.id !== id);
    });
  }

  /** El periodo que está bloqueando la edición ahora mismo, o null. Lo usan las pantallas de coordinador y docente. */
  vigente(): Observable<GuideEditLock | null> {
    return this.listar().pipe(map((locks) => locks.find((lock) => lock.active) ?? null));
  }

  activo(): GuideEditLock | null {
    const now = Date.now();
    const lock = this.db.bloqueosEdicion.find(
      (item) => Date.parse(item.startsAt) <= now && Date.parse(item.endsAt) > now,
    );
    return lock ? this.map(lock) : null;
  }

  private map(lock: Omit<GuideEditLock, 'active'>): GuideEditLock {
    return { ...lock, active: Date.parse(lock.startsAt) <= Date.now() && Date.parse(lock.endsAt) > Date.now() };
  }
}
