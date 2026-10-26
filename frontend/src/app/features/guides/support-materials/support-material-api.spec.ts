import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../../testing/test-helpers';
import { SupportMaterialApi, validarArchivo } from './support-material-api';

const pdf = (nombre = 'lectura.pdf', bytes = 10) =>
  new File([new Uint8Array(bytes)], nombre, { type: 'application/pdf' });

describe('Materiales de apoyo (simulado)', () => {
  let api: SupportMaterialApi;

  beforeEach(async () => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(SupportMaterialApi);
    await entrarComo(CORREOS.coordinador);
  });

  afterEach(limpiarSesion);

  it('valida tipo y tamaño antes de subir', () => {
    expect(validarArchivo(pdf())).toBeNull();
    expect(validarArchivo(new File(['x'], 'foto.png'))).toBe('TIPO_NO_PERMITIDO');
    expect(validarArchivo(pdf('grande.pdf', 10 * 1024 * 1024 + 1))).toBe('ARCHIVO_MUY_GRANDE');
  });

  it('sube, lista, descarga y elimina un material', async () => {
    const subido = await firstValueFrom(api.subir(1, pdf()));
    expect(subido.uploadedBy?.name).toBeTruthy();
    expect((await firstValueFrom(api.listar(1))).map((m) => m.fileName)).toEqual(['lectura.pdf']);
    expect((await firstValueFrom(api.descargar(1, subido.id))).size).toBe(10);

    await firstValueFrom(api.eliminar(1, subido.id));
    expect(await firstValueFrom(api.listar(1))).toEqual([]);
  });

  it('rechaza un archivo que no es PDF ni DOCX', async () => {
    const error = await capturarError(api.subir(1, new File(['x'], 'virus.exe')));
    expect(error.code).toBe('TIPO_NO_PERMITIDO');
  });
});
