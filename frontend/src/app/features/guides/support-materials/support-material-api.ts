import { Injectable, inject } from '@angular/core';
import { Observable, map, timer } from 'rxjs';
import { Auth } from '../../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../../core/mock/latency';
import { MockDb } from '../../../core/mock/mock-db';
import { ApiError } from '../../../shared/models/api-error';
import {
  MATERIAL_EXTENSIONES,
  MATERIAL_MAX_BYTES,
  SupportMaterial,
} from '../../../shared/models/support-material';
import { ahoraIso } from '../../../shared/utils/fechas';

/** Revisa tipo y tamaño antes de enviar el archivo. Devuelve el código de error o null. */
export function validarArchivo(archivo: File): string | null {
  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  if (!MATERIAL_EXTENSIONES.includes(extension)) return 'TIPO_NO_PERMITIDO';
  if (archivo.size > MATERIAL_MAX_BYTES) return 'ARCHIVO_MUY_GRANDE';
  return null;
}

/** Lo que deben ofrecer las dos implementaciones (simulada y HTTP). */
export type ContratoSupportMaterialApi = Pick<SupportMaterialApi, 'listar' | 'subir' | 'descargar' | 'eliminar'>;

/**
 * Materiales de apoyo de una guía. Imita las rutas del backend:
 * GET/POST /academic/guides/:id/support-materials,
 * GET .../:materialId/download y DELETE .../:materialId.
 */
@Injectable({ providedIn: 'root' })
export class SupportMaterialApi {
  private db = inject(MockDb);
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);

  listar(guideId: number): Observable<SupportMaterial[]> {
    return simular(this.ms, () =>
      this.db.materiales.filter((m) => m.guideId === guideId).map(({ contenido, guideId, ...m }) => m),
    );
  }

  subir(guideId: number, archivo: File): Observable<SupportMaterial> {
    const error = validarArchivo(archivo);
    return simular(this.ms, () => {
      if (error) throw new ApiError(error);
      const usuario = this.auth.user();
      const material = {
        id: crypto.randomUUID(),
        guideId,
        fileName: archivo.name,
        contentType: archivo.type,
        size: archivo.size,
        createdAt: ahoraIso(),
        uploadedBy: usuario ? { id: String(usuario.id), name: usuario.nombre } : null,
        contenido: archivo as Blob,
      };
      this.db.materiales.push(material);
      const { contenido, guideId: _, ...vista } = material;
      return vista;
    });
  }

  descargar(guideId: number, materialId: string): Observable<Blob> {
    return timer(this.ms).pipe(
      map(() => {
        const material = this.db.materiales.find((m) => m.id === materialId && m.guideId === guideId);
        if (!material) throw new ApiError('NOT_FOUND');
        return material.contenido;
      }),
    );
  }

  eliminar(guideId: number, materialId: string): Observable<void> {
    return simular(this.ms, () => {
      const i = this.db.materiales.findIndex((m) => m.id === materialId && m.guideId === guideId);
      if (i < 0) throw new ApiError('NOT_FOUND');
      this.db.materiales.splice(i, 1);
    });
  }
}
