import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
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
}