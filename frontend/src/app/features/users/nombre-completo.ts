/**
 * Nombre completo: al menos dos palabras (nombre y apellido). Keycloak exige el apellido y, sin él,
 * la cuenta no puede iniciar sesión. Es la misma regla que valida la API.
 */
export const NOMBRE_COMPLETO = /^\s*\S+(\s+\S+)+\s*$/;
