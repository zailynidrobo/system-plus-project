import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DetalleDeRol, ResumenDeRol } from '../../../shared/models/audit';
import { Role } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { AuditApi } from '../audit-api';

interface FilaMatriz {
  action: string;
  roles: Set<Role>;
}

interface GrupoMatriz {
  area: string;
  filas: FilaMatriz[];
}

// Figma HE-08-HU-02 · matriz de permisos por rol (solo administrador)
@Component({
  selector: 'app-role-permissions',
  imports: [Icon],
  templateUrl: './role-permissions.html',
  styleUrl: './role-permissions.scss',
})
export class RolePermissions {
  private api = inject(AuditApi);

  roles = signal<ResumenDeRol[]>([]);
  detalles = signal<DetalleDeRol[]>([]);
  resaltado = signal<Role>('DOCENTE');
  cargando = signal(true);
  error = signal<string | null>(null);

  /** Todas las acciones que alguien puede hacer, agrupadas por area, con los roles que sí pueden. */
  grupos = computed<GrupoMatriz[]>(() => {
    const porArea = new Map<string, Map<string, Set<Role>>>();
    for (const d of this.detalles()) {
      for (const p of d.permissions) {
        const acciones = porArea.get(p.area) ?? new Map<string, Set<Role>>();
        acciones.set(p.action, (acciones.get(p.action) ?? new Set<Role>()).add(d.role));
        porArea.set(p.area, acciones);
      }
    }
    return [...porArea]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([area, acciones]) => ({
        area,
        filas: [...acciones].sort(([a], [b]) => a.localeCompare(b)).map(([action, roles]) => ({ action, roles })),
      }));
  });

  totalAcciones = computed(() => this.grupos().reduce((n, g) => n + g.filas.length, 0));

  /** Resumen del rol resaltado (tarjeta de la derecha). */
  resumen = computed(() => {
    const rol = this.resaltado();
    const permitidas = this.grupos()
      .map((g) => ({ area: g.area, n: g.filas.filter((f) => f.roles.has(rol)).length }))
      .filter((g) => g.n > 0);
    const n = permitidas.reduce((total, g) => total + g.n, 0);
    return {
      etiqueta: this.roles().find((r) => r.role === rol)?.label ?? '',
      permitidas: n,
      noPermitidas: this.totalAcciones() - n,
      areas: permitidas.map((g) => g.area),
    };
  });

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.roles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        if (roles.length && !roles.some((r) => r.role === this.resaltado())) this.resaltado.set(roles[0].role);
        if (roles.length === 0) {
          this.detalles.set([]);
          this.cargando.set(false);
          return;
        }
        forkJoin(roles.map((r) => this.api.rol(r.role))).subscribe({
          next: (detalles) => {
            this.detalles.set(detalles);
            this.cargando.set(false);
          },
          error: () => this.fallar(),
        });
      },
      error: () => this.fallar(),
    });
  }

  private fallar(): void {
    this.cargando.set(false);
    this.error.set('No pudimos cargar los permisos. Verifica que la API esté disponible e inténtalo de nuevo.');
  }

  resaltar(valor: string): void {
    this.resaltado.set(valor as Role);
  }

  /** "Guías base, Sugerencias" (máximo 3 áreas y puntos suspensivos si hay más). */
  listaAreas(areas: string[]): string {
    return areas.length > 3 ? `${areas.slice(0, 3).join(', ')}…` : areas.join(', ');
  }
}
