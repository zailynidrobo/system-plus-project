/** Material de apoyo (PDF o DOCX) adjunto a una guía base. */
export interface SupportMaterial {
  id: string;
  fileName: string;
  contentType: string;
  /** Tamaño en bytes. */
  size: number;
  createdAt: string;
  /** Quién lo subió; null en materiales antiguos que no guardaban ese dato. */
  uploadedBy: { id: string; name: string } | null;
}

export const MATERIAL_MAX_BYTES = 10 * 1024 * 1024;
export const MATERIAL_EXTENSIONES = ['pdf', 'docx'];
