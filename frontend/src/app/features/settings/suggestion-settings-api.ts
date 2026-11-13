import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { ApiError } from '../../shared/models/api-error';
import { SuggestionSettings, SuggestionSettingsChange } from '../../shared/models/suggestion-settings';

/** Versión en memoria (modo mock). En modo http la reemplaza HttpSuggestionSettingsApi. */
@Injectable({ providedIn: 'root' })
export class SuggestionSettingsApi {
  private auth = inject(Auth);
  private ms = inject(MOCK_LATENCY);
  private actual: SuggestionSettings = {
    dueBusinessDays: 8,
    dueSoonBusinessDays: 5,
    source: 'env',
    updatedAt: null,
    updatedByName: null,
  };

  obtener(): Observable<SuggestionSettings> {
    return simular(this.ms, () => this.actual);
  }

  guardar(cambio: SuggestionSettingsChange): Observable<SuggestionSettings> {
    return simular(this.ms, () => {
      if (cambio.dueSoonBusinessDays > cambio.dueBusinessDays) throw new ApiError('DUE_SOON_AFTER_DUE');
      this.actual = {
        ...cambio,
        source: 'admin',
        updatedAt: new Date().toISOString(),
        updatedByName: this.auth.user()?.nombre ?? 'Administrador',
      };
      return this.actual;
    });
  }
}
