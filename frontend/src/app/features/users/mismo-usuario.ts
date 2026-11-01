import { ApiError } from '../../shared/models/api-error';
import { User } from '../../shared/models/user';

/** true si `otro` es la misma cuenta que tiene la sesión abierta. */
export function esMismoUsuario(sesion: User | null | undefined, otro: User | null | undefined): boolean {
  if (!sesion || !otro) return false;
  if (sesion.keycloakId && otro.keycloakId) return sesion.keycloakId === otro.keycloakId;
  return sesion.correo.trim().toLowerCase() === otro.correo.trim().toLowerCase();
}

const MENSAJES: Record<string, string> = {
  ACCION_SOBRE_SI_MISMO: 'No puedes desactivar ni cambiar el rol de tu propia cuenta.',
  ULTIMO_ADMINISTRADOR: 'Debe quedar al menos un administrador activo en el sistema.',
  SIN_PERMISO: 'No tienes permiso para hacer esta acción.',
  NO_ENCONTRADO: 'El usuario ya no existe.',
};

/** Texto para mostrar en pantalla a partir del error de la API. */
export function mensajeDeError(e: unknown, porDefecto: string): string {
  return e instanceof ApiError ? (MENSAJES[e.code] ?? porDefecto) : porDefecto;
}
