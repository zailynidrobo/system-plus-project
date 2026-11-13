import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { PERMISOS_MOCK, crearEventosAuditoria, detalleDeRolMock } from '../../core/mock/seed-audit';
import { ApiError } from '../../shared/models/api-error';
import {
  DetalleDeRol,
  DetalleEventoAuditoria,
  FiltroAuditoria,
  OpcionesAuditoria,
  PaginaAuditoria,
  ResumenDeRol,
} from '../../shared/models/audit';
import { ROLE_LABELS, Role } from '../../shared/models/user';
import { diaBogota, nombreAuditoria } from '../../shared/utils/auditoria';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Auditoría (HE-08) con datos de prueba. Con api = 'http' se usa HttpAuditApi, que tiene la misma
 * API pública y habla con /audit del backend.
 */
@Injectable({ providedIn: 'root' })
export class AuditApi {
  private db = inject(MockDb);
  private ms = inject(MOCK_LATENCY);
  private eventos: DetalleEventoAuditoria[] | null = null;

  private todos(): DetalleEventoAuditoria[] {
    return (this.eventos ??= crearEventosAuditoria(this.db.usuarios, this.db.modulos, this.db.guias));
  }

  listar(f: FiltroAuditoria): Observable<PaginaAuditoria> {
    return simular(this.ms, () => {
      if (f.desde && f.hasta && f.desde > f.hasta) throw new ApiError('INVALID_DATE_RANGE');
      const q = normalizar(f.busqueda.trim());
      const filtrados = this.todos().filter((e) => {
        if (f.userId && e.user.id !== f.userId) return false;
        if (f.moduleId && e.module?.id !== f.moduleId) return false;
        if (f.area && e.area !== f.area) return false;
        if (f.resultado !== 'TODOS' && e.result !== f.resultado) return false;
        const dia = diaBogota(e.occurredAt);
        if (f.desde && dia < f.desde) return false;
        if (f.hasta && dia > f.hasta) return false;
        if (!q) return true;
        return [nombreAuditoria(e.user), e.user.email ?? '', e.action, e.entity?.label ?? ''].some((t) => normalizar(t).includes(q));
      });
      const inicio = (f.pagina - 1) * f.porPagina;
      const items = filtrados.slice(inicio, inicio + f.porPagina).map(({ occurredAt, id, user, area, action, result, statusCode, ip, entity, module }) => ({
        id, occurredAt, user, area, action, result, statusCode, ip, entity, module,
      }));
      return { items, total: filtrados.length };
    });
  }

  opciones(): Observable<OpcionesAuditoria> {
    return simular(this.ms, () => {
      const usuarios = new Map<string, { id: string; name: string; email: string }>();
      const modulos = new Map<string, { id: string; name: string }>();
      for (const e of this.todos()) {
        if (e.user.id && e.user.name) usuarios.set(e.user.id, { id: e.user.id, name: e.user.name, email: e.user.email ?? '' });
        if (e.module) modulos.set(e.module.id, e.module);
      }
      return {
        users: [...usuarios.values()].sort((a, b) => a.name.localeCompare(b.name)),
        modules: [...modulos.values()].sort((a, b) => a.name.localeCompare(b.name)),
        areas: [...new Set(this.todos().map((e) => e.area))].sort(),
      };
    });
  }

  detalle(id: string): Observable<DetalleEventoAuditoria> {
    return simular(this.ms, () => {
      const e = this.todos().find((x) => x.id === id);
      if (!e) throw new ApiError('NOT_FOUND');
      return e;
    });
  }

  roles(): Observable<ResumenDeRol[]> {
    return simular(this.ms, () =>
      (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
        role,
        label: ROLE_LABELS[role],
        totalPermissions: PERMISOS_MOCK[role].length,
        areas: [...new Set(PERMISOS_MOCK[role].map((p) => p.area))].sort(),
      })),
    );
  }

  rol(role: Role): Observable<DetalleDeRol> {
    return simular(this.ms, () => {
      if (!(role in PERMISOS_MOCK)) throw new ApiError('NOT_FOUND');
      return detalleDeRolMock(role);
    });
  }
}
