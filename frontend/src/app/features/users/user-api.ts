import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { MockDb } from '../../core/mock/mock-db';
import { UsuarioMock, sinContrasena, tituloRolAsignado } from '../../core/mock/seed-users';
import { ApiError } from '../../shared/models/api-error';
import { EventoUsuario, ROLE_LABELS, Role, User } from '../../shared/models/user';
import { ahoraIso, fechaCorta } from '../../shared/utils/fechas';

export interface FiltroUsuarios {
  busqueda: string;
  rol: Role | 'TODOS';
  estado: 'TODOS' | 'ACTIVO' | 'DESACTIVADO';
  pagina: number;
  porPagina: number;
}

export interface PaginaUsuarios {
  items: User[];
  total: number;
}

export interface ResumenUsuarios {
  total: number;
  activos: number;
  desactivados: number;
}

export interface NuevoUsuario {
  nombre: string;
  correo: string;
  rol: Role;
}

const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Los usuarios viven en MockDb: son los mismos con los que se inicia sesión,
// así desactivar o cambiar el rol aquí afecta al login (HU-03 y HU-04).
@Injectable({ providedIn: 'root' })
export class UserApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);

  listar(f: FiltroUsuarios): Observable<PaginaUsuarios> {
    return simular(this.ms, () => {
      const q = normalizar(f.busqueda.trim());
      const filtrados = this.db.usuarios.filter((u) => {
        const coincideTexto = !q || normalizar(u.nombre).includes(q) || normalizar(u.correo).includes(q);
        const coincideRol = f.rol === 'TODOS' || u.rol === f.rol;
        const coincideEstado =
          f.estado === 'TODOS' || (f.estado === 'ACTIVO' ? u.activo : !u.activo);
        return coincideTexto && coincideRol && coincideEstado;
      });
      const inicio = (f.pagina - 1) * f.porPagina;
      return {
        items: filtrados.slice(inicio, inicio + f.porPagina).map(sinContrasena),
        total: filtrados.length,
      };
    });
  }

  resumen(): Observable<ResumenUsuarios> {
    return simular(this.ms, () => {
      const activos = this.db.usuarios.filter((u) => u.activo).length;
      return {
        total: this.db.usuarios.length,
        activos,
        desactivados: this.db.usuarios.length - activos,
      };
    });
  }

  /** Tarjetas de "Roles y permisos": cuántos usuarios tienen cada rol. */
  conteoPorRol(): Observable<Record<Role, number>> {
    return simular(this.ms, () => {
      const conteo = Object.fromEntries(Object.keys(ROLE_LABELS).map((r) => [r, 0])) as Record<Role, number>;
      for (const u of this.db.usuarios) conteo[u.rol]++;
      return conteo;
    });
  }

  /** Validación en vivo del registro: "Correo disponible". */
  correoDisponible(correo: string): Observable<boolean> {
    return simular(this.ms, () => {
      const buscado = correo.trim().toLowerCase();
      return !this.db.usuarios.some((u) => u.correo.toLowerCase() === buscado);
    });
  }

  /** "Historial reciente" de Editar usuario: el último acceso y los 2 eventos más recientes. */
  historial(id: number): Observable<EventoUsuario[]> {
    return simular(this.ms, () => {
      const usuario = this.buscar(id);
      const eventos: EventoUsuario[] = this.db.eventosUsuarios
        .filter((e) => e.userId === id)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 2)
        .map((e) => ({ titulo: e.titulo, detalle: `${fechaCorta(e.fecha)} · ${e.responsable}` }));
      if (usuario.ultimoAcceso && usuario.ultimoAcceso !== 'Sin ingresos') {
        eventos.unshift({ titulo: 'Inicio de sesión', detalle: `${usuario.ultimoAcceso} · Acceso seguro` });
      }
      return eventos;
    });
  }

  // El backend real debe responder error si el correo ya existe y generar la contraseña temporal.
  crear(d: NuevoUsuario): Observable<User> {
    return simular(this.ms, () => {
      const correo = d.correo.trim().toLowerCase();
      if (this.db.usuarios.some((u) => u.correo.toLowerCase() === correo)) {
        throw new ApiError('CORREO_EN_USO');
      }
      const nuevo: UsuarioMock = {
        id: Math.max(...this.db.usuarios.map((u) => u.id)) + 1,
        nombre: d.nombre.trim(),
        correo,
        // Nadie conoce la contraseña temporal; el backend real la genera y la guarda cifrada
        contrasena: null,
        rol: d.rol,
        activo: true,
        ultimoAcceso: 'Sin ingresos',
        creadoEn: ahoraIso(),
      };
      this.db.usuarios = [nuevo, ...this.db.usuarios];
      this.registrarEvento(nuevo.id, 'Usuario registrado');
      this.registrarEvento(nuevo.id, tituloRolAsignado(nuevo.rol));
      return sinContrasena(nuevo);
    });
  }

  obtener(id: number): Observable<User> {
    return simular(this.ms, () => sinContrasena(this.buscar(id)));
  }

  // Solo se editan nombre y correo. El rol y la contraseña no cambian aquí.
  actualizar(id: number, d: { nombre: string; correo: string }): Observable<User> {
    return simular(this.ms, () => {
      const correo = d.correo.trim().toLowerCase();
      this.buscar(id);
      if (this.db.usuarios.some((u) => u.id !== id && u.correo.toLowerCase() === correo)) {
        throw new ApiError('CORREO_EN_USO');
      }
      const actualizado = this.reemplazar(id, { nombre: d.nombre.trim(), correo });
      this.registrarEvento(id, 'Datos actualizados');
      return actualizado;
    });
  }

  // Desactivar NO borra: solo cambia el estado. El historial y los datos se conservan.
  desactivar(id: number): Observable<User> {
    return simular(this.ms, () => {
      const actualizado = this.reemplazar(id, { activo: false });
      this.registrarEvento(id, 'Usuario desactivado');
      return actualizado;
    });
  }

  // Un usuario tiene un solo rol activo: este cambio reemplaza al anterior.
  cambiarRol(id: number, rol: Role): Observable<User> {
    return simular(this.ms, () => {
      const actualizado = this.reemplazar(id, { rol });
      this.registrarEvento(id, tituloRolAsignado(rol));
      return actualizado;
    });
  }

  private buscar(id: number): UsuarioMock {
    const usuario = this.db.usuarios.find((u) => u.id === id);
    if (!usuario) throw new ApiError('NO_ENCONTRADO');
    return usuario;
  }

  private registrarEvento(userId: number, titulo: string): void {
    const responsable = this.auth.user()?.nombre ?? 'Sistema';
    this.db.eventosUsuarios = [...this.db.eventosUsuarios, { userId, titulo, responsable, fecha: ahoraIso() }];
  }

  private reemplazar(id: number, cambios: Partial<UsuarioMock>): User {
    const actualizado: UsuarioMock = { ...this.buscar(id), ...cambios };
    this.db.usuarios = this.db.usuarios.map((u) => (u.id === id ? actualizado : u));
    return sinContrasena(actualizado);
  }
}
