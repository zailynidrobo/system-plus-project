import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { Role, User } from '../../shared/models/user';

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
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const NOMBRES = [
  'María Camila Rojas', 'Julián Andrés Ospina', 'Paola Valencia', 'Carlos Ramírez',
  'Diana Marcela Ruiz', 'Santiago Gómez', 'Laura Muñoz', 'Andrés Felipe Cruz',
  'Natalia Herrera', 'Sebastián Mora', 'Valentina Díaz', 'Camilo Torres',
  'Mariana Ortiz', 'Daniel Castro', 'Juliana Pineda', 'Esteban Ramos',
  'Sara Delgado', 'Felipe Quintero', 'Isabela Rincón', 'Mateo Vargas',
  'Lucía Salazar', 'Tomás Acosta', 'Gabriela León', 'Nicolás Peña',
];
const ROLES: Role[] = ['COORDINADOR', 'DOCENTE', 'DOCENTE_AUTORIZADO', 'DOCENTE', 'ADMINISTRADOR', 'DOCENTE'];
const ACCESOS = ['Hoy, 8:42 a. m.', 'Ayer, 4:18 p. m.', '25 sep, 10:06 a. m.', '18 sep, 2:31 p. m.', '24 sep, 9:54 a. m.', '23 sep, 7:12 a. m.'];

function crearMock(): User[] {
  return NOMBRES.map((nombre, i) => {
    const partes = normalizar(nombre).split(' ');
    return {
      id: i + 1,
      nombre,
      correo: `${partes[0]}.${partes[partes.length - 1]}@systemplus.edu.co`,
      rol: ROLES[i % ROLES.length],
      activo: i % 8 !== 3,
      ultimoAcceso: ACCESOS[i % ACCESOS.length],
    };
  });
}

@Injectable({ providedIn: 'root' })
export class UserApi {
  private datos = crearMock();

  listar(f: FiltroUsuarios): Observable<PaginaUsuarios> {
    const q = normalizar(f.busqueda.trim());
    const filtrados = this.datos.filter((u) => {
      const coincideTexto = !q || normalizar(u.nombre).includes(q) || normalizar(u.correo).includes(q);
      const coincideRol = f.rol === 'TODOS' || u.rol === f.rol;
      const coincideEstado =
        f.estado === 'TODOS' || (f.estado === 'ACTIVO' ? u.activo : !u.activo);
      return coincideTexto && coincideRol && coincideEstado;
    });
    const inicio = (f.pagina - 1) * f.porPagina;
    return of({
      items: filtrados.slice(inicio, inicio + f.porPagina),
      total: filtrados.length,
    }).pipe(delay(300));
  }

  resumen(): Observable<ResumenUsuarios> {
    const activos = this.datos.filter((u) => u.activo).length;
    return of({
      total: this.datos.length,
      activos,
      desactivados: this.datos.length - activos,
    }).pipe(delay(300));
  }

  // El backend real debe responder error si el correo ya existe y generar la contraseña temporal.
  crear(d: NuevoUsuario): Observable<User> {
    const correo = d.correo.trim().toLowerCase();
    if (this.datos.some((u) => u.correo.toLowerCase() === correo)) {
      return throwError(() => new Error('CORREO_EN_USO')).pipe(delay(400));
    }
    const nuevo: User = {
      id: Math.max(...this.datos.map((u) => u.id)) + 1,
      nombre: d.nombre.trim(),
      correo,
      rol: d.rol,
      activo: true,
      ultimoAcceso: 'Sin ingresos',
    };
    this.datos = [nuevo, ...this.datos];
    return of(nuevo).pipe(delay(500));
  }

    obtener(id: number): Observable<User> {
    const usuario = this.datos.find((u) => u.id === id);
    if (!usuario) return throwError(() => new Error('NO_ENCONTRADO'));
    return of({ ...usuario }).pipe(delay(300));
  }

  // Solo se editan nombre y correo. El rol y la contraseña no cambian aquí.
  actualizar(id: number, d: { nombre: string; correo: string }): Observable<User> {
    const correo = d.correo.trim().toLowerCase();
    const indice = this.datos.findIndex((u) => u.id === id);
    if (indice === -1) return throwError(() => new Error('NO_ENCONTRADO'));

    if (this.datos.some((u) => u.id !== id && u.correo.toLowerCase() === correo)) {
      return throwError(() => new Error('CORREO_EN_USO')).pipe(delay(400));
    }

    const actualizado: User = { ...this.datos[indice], nombre: d.nombre.trim(), correo };
    this.datos = this.datos.map((u, i) => (i === indice ? actualizado : u));
    return of({ ...actualizado }).pipe(delay(500));
  }

    // Desactivar NO borra: solo cambia el estado. El historial y los datos se conservan.
  desactivar(id: number): Observable<User> {
    const indice = this.datos.findIndex((u) => u.id === id);
    if (indice === -1) return throwError(() => new Error('NO_ENCONTRADO'));

    const actualizado: User = { ...this.datos[indice], activo: false };
    this.datos = this.datos.map((u, i) => (i === indice ? actualizado : u));
    return of({ ...actualizado }).pipe(delay(500));
  }

    // Un usuario tiene un solo rol activo: este cambio reemplaza al anterior.
  cambiarRol(id: number, rol: Role): Observable<User> {
    const indice = this.datos.findIndex((u) => u.id === id);
    if (indice === -1) return throwError(() => new Error('NO_ENCONTRADO'));

    const actualizado: User = { ...this.datos[indice], rol };
    this.datos = this.datos.map((u, i) => (i === indice ? actualizado : u));
    return of({ ...actualizado }).pipe(delay(500));
  }
}