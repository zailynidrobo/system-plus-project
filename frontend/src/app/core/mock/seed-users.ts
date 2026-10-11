import { Role, User } from '../../shared/models/user';

export interface UsuarioMock extends User {
  /** null = no puede iniciar sesión en el mock (su contraseña la generó el sistema y nadie la conoce). */
  contrasena: string | null;
}

const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Mismo orden, roles, estados y accesos que el listado de Figma (PanelDeAdministrador).
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

// Usuarios de prueba que pueden iniciar sesión (contraseña 123456), por posición en NOMBRES.
// Los nombres salen de Figma: Laura Muñoz es la coordinadora y Julián Andrés Ospina el docente.
const CUENTAS_DE_PRUEBA: Record<number, string> = {
  1: 'docente@systemplus.edu.co', // Julián Andrés Ospina · Docente
  2: 'autorizado@systemplus.edu.co', // Paola Valencia · Docente Autorizado
  3: 'inactivo@systemplus.edu.co', // Carlos Ramírez · Docente desactivado
  4: 'admin@systemplus.edu.co', // Diana Marcela Ruiz · Administrador
  6: 'coordinador@systemplus.edu.co', // Laura Muñoz · Coordinador Académico
};

export const CONTRASENA_DE_PRUEBA = '123456';

export function crearUsuarios(): UsuarioMock[] {
  return NOMBRES.map((nombre, i) => {
    const partes = normalizar(nombre).split(' ');
    const cuenta = CUENTAS_DE_PRUEBA[i];
    return {
      id: i + 1,
      nombre,
      correo: cuenta ?? `${partes[0]}.${partes[partes.length - 1]}@systemplus.edu.co`,
      contrasena: cuenta ? CONTRASENA_DE_PRUEBA : null,
      rol: ROLES[i % ROLES.length],
      activo: i % 8 !== 3,
      ultimoAcceso: ACCESOS[i % ACCESOS.length],
    };
  });
}

export function sinContrasena({ contrasena: _, ...usuario }: UsuarioMock): User {
  return usuario;
}
