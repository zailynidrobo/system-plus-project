import { Injectable } from '@nestjs/common';
import { execFile as execFileCallback } from 'node:child_process';
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { construirGuiaDocx, type GuiaDocx } from './guia-docx.js';

const execFile = promisify(execFileCallback);

/** Datos de una guía para exportarla; nombreArchivo da el nombre de la descarga (sin extensión). */
export interface GuideDocumentData extends GuiaDocx {
  nombreArchivo: string;
}

@Injectable()
export class GuideDocumentExportService {
  async toDocx(data: GuideDocumentData) {
    const logo = await readFile(
      fileURLToPath(
        new URL('./templates/logo-system-plus.png', import.meta.url),
      ),
    );
    return construirGuiaDocx(data, logo);
  }

  async toPdf(data: GuideDocumentData) {
    return this.convertirAPdf(await this.toDocx(data), 'docx');
  }

  /** Convierte un Word o un Excel a PDF con LibreOffice (lo usan las guías y los reportes). */
  async convertirAPdf(archivo: Buffer, extension: 'docx' | 'xlsx') {
    const tempDirectory = await mkdtemp(join(tmpdir(), 'gestion-guias-'));
    const inputPath = join(tempDirectory, `documento.${extension}`);
    const outputPath = join(tempDirectory, 'documento.pdf');
    const profilePath = pathToFileURL(join(tempDirectory, 'profile')).href;
    const libreOfficePath =
      process.env.LIBREOFFICE_PATH ??
      (process.platform === 'win32' ? 'soffice.com' : 'soffice');

    try {
      await writeFile(inputPath, archivo);
      try {
        const conversion = await execFile(
          libreOfficePath,
          [
            '--headless',
            `-env:UserInstallation=${profilePath}`,
            '--convert-to',
            'pdf',
            '--outdir',
            tempDirectory,
            inputPath,
          ],
          { timeout: 120_000 },
        );
        try {
          await access(outputPath);
        } catch (error) {
          const files = await readdir(tempDirectory).catch(() => []);
          throw new Error(
            `LibreOffice no generó el PDF. Archivos producidos: ${files.join(', ') || 'ninguno'}. ${conversion.stderr || conversion.stdout || 'Sin diagnóstico.'}`,
            { cause: error },
          );
        }
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          throw new Error(
            'No se encontró LibreOffice. Instálalo o configura LIBREOFFICE_PATH con la ruta a soffice.exe.',
            { cause: error },
          );
        }
        throw error;
      }
      return await readFile(outputPath);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
