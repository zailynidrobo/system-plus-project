import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SuggestionSettings, SuggestionSettingsChange } from '../../shared/models/suggestion-settings';
import { falla } from '../academic-program/http-errores';
import { SuggestionSettingsApi } from './suggestion-settings-api';

@Injectable()
export class HttpSuggestionSettingsApi extends SuggestionSettingsApi {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/academic/settings/suggestion-deadline`;

  override obtener(): Observable<SuggestionSettings> {
    return this.http.get<SuggestionSettings>(this.url).pipe(catchError(falla()));
  }

  override guardar(cambio: SuggestionSettingsChange): Observable<SuggestionSettings> {
    return this.http.put<SuggestionSettings>(this.url, cambio).pipe(catchError(falla()));
  }
}
