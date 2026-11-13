import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HttpSuggestionSettingsApi } from './http-suggestion-settings-api';

const URL = `${environment.apiUrl}/academic/settings/suggestion-deadline`;

describe('HttpSuggestionSettingsApi', () => {
  let api: HttpSuggestionSettingsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HttpSuggestionSettingsApi, provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(HttpSuggestionSettingsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta el tiempo límite vigente', async () => {
    const respuesta = firstValueFrom(api.obtener());
    http.expectOne({ method: 'GET', url: URL }).flush({ dueBusinessDays: 8, dueSoonBusinessDays: 5, source: 'env', updatedAt: null, updatedByName: null });
    expect((await respuesta).dueBusinessDays).toBe(8);
  });

  it('guarda con PUT y traduce el código de error del backend', async () => {
    const respuesta = firstValueFrom(api.guardar({ dueBusinessDays: 4, dueSoonBusinessDays: 6 }));
    const peticion = http.expectOne({ method: 'PUT', url: URL });
    expect(peticion.request.body).toEqual({ dueBusinessDays: 4, dueSoonBusinessDays: 6 });
    peticion.flush({ statusCode: 400, code: 'DUE_SOON_AFTER_DUE', message: 'x' }, { status: 400, statusText: 'Bad Request' });
    await expect(respuesta).rejects.toMatchObject({ code: 'DUE_SOON_AFTER_DUE' });
  });
});
