import { Injectable } from '@nestjs/common';

export type MotivoRevocacion = 'ROL_ACTUALIZADO' | 'CUENTA_DESACTIVADA';

const MENSAJES: Record<MotivoRevocacion, string> = {
  ROL_ACTUALIZADO: 'Su rol cambió. La sesión se actualizará con los nuevos permisos.',
  CUENTA_DESACTIVADA: 'Su cuenta fue desactivada.',
};

/** Tiempo que se recuerda una revocación: mayor que la vida máxima de un token de acceso. */
const RETENCION_SEGUNDOS = 24 * 60 * 60;

/**
 * Los tokens de Keycloak son válidos hasta que vencen, aunque al usuario se le cambie el rol o se
 * le desactive la cuenta. Este registro guarda cuándo ocurrió ese cambio para rechazar los tokens
 * emitidos antes (DEF-02 y DEF-04). Un token nuevo, obtenido después del cambio, se acepta y ya
 * trae los roles vigentes. El registro vive en memoria: la API corre en una sola instancia.
 */
@Injectable()
export class SessionRevocationService {
  private readonly revocaciones = new Map<string, { en: number; motivo: MotivoRevocacion }>();

  revocar(userId: string, motivo: MotivoRevocacion, ahoraMs = Date.now()): void {
    this.limpiar(ahoraMs);
    this.revocaciones.set(userId, { en: Math.floor(ahoraMs / 1000), motivo });
  }

  /** Motivo por el que el token ya no vale, o null si sigue vigente. `iat` en segundos. */
  motivo(userId: string, emitidoEn: number | undefined): MotivoRevocacion | null {
    const revocacion = this.revocaciones.get(userId);
    if (!revocacion) return null;
    // Un token emitido en el mismo segundo del cambio se trata como anterior: es más seguro.
    return emitidoEn === undefined || emitidoEn <= revocacion.en ? revocacion.motivo : null;
  }

  mensaje(motivo: MotivoRevocacion): string {
    return MENSAJES[motivo];
  }

  private limpiar(ahoraMs: number): void {
    const limite = Math.floor(ahoraMs / 1000) - RETENCION_SEGUNDOS;
    for (const [id, { en }] of this.revocaciones) if (en < limite) this.revocaciones.delete(id);
  }
}
