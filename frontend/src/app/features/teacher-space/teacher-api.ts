import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { AcademicModule } from '../../shared/models/academic-module';

/** Espacio del docente (HE-04): todo se filtra por los módulos asignados a quien tiene la sesión. */
@Injectable({ providedIn: 'root' })
export class TeacherApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);

  misModulos(): Observable<AcademicModule[]> {
    return simular(this.ms, () => {
      const ids = this.idsAsignados();
      return this.db.modulos.filter((m) => ids.has(m.id));
    });
  }

  private idsAsignados(): Set<number> {
    const docenteId = this.auth.user()?.id;
    return new Set(
      this.db.asignaciones.filter((a) => a.teacherId === docenteId).map((a) => a.moduleId),
    );
  }
}
