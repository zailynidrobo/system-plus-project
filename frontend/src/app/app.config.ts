import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideAuth } from './core/auth/provide-auth';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { environment } from '../environments/environment';
import { HttpUserApi } from './features/users/http-user-api';
import { CompetencyApi } from './features/academic-program/competency-api';
import { HttpCompetencyApi } from './features/academic-program/http-competency-api';
import { HttpModuleApi } from './features/academic-program/http-module-api';
import { ModuleApi } from './features/academic-program/module-api';
import { UserApi } from './features/users/user-api';
import { FieldConfigApi } from './features/guides/field-config-api';
import { HttpFieldConfigApi } from './features/guides/http-field-config-api';
import { GuideApi } from './features/guides/guide-api';
import { HttpGuideApi } from './features/guides/http-guide-api';
import { HttpTeacherApi } from './features/teacher-space/http-teacher-api';
import { TeacherApi } from './features/teacher-space/teacher-api';
import { SupportMaterialApi } from './features/guides/support-materials/support-material-api';
import { HttpSupportMaterialApi } from './features/guides/support-materials/http-support-material-api';
import { HttpSuggestionApi } from './features/suggestions/http-suggestion-api';
import { SuggestionApi } from './features/suggestions/suggestion-api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAuth(),
    // HE-01: con api = 'http' las pantallas de usuarios hablan con el backend; si no, con el mock.
    ...(environment.api === 'http' ? [{ provide: UserApi, useClass: HttpUserApi }] : []),
    // HE-02: con apiAcademico = 'http' módulos y competencias usan el backend; si no, el mock.
    ...(environment.apiAcademico === 'http'
      ? [
          { provide: ModuleApi, useClass: HttpModuleApi },
          { provide: CompetencyApi, useClass: HttpCompetencyApi },
          { provide: GuideApi, useClass: HttpGuideApi },
          { provide: FieldConfigApi, useClass: HttpFieldConfigApi },
          // HE-04: espacio docente (guías asignadas y versiones propias) contra el backend.
          { provide: TeacherApi, useClass: HttpTeacherApi },
          // Materiales de apoyo de las guías (PDF o DOCX).
          { provide: SupportMaterialApi, useClass: HttpSupportMaterialApi },
          // HE-05: sugerencias de cambio.
          { provide: SuggestionApi, useClass: HttpSuggestionApi },
        ]
      : []),
  ],
};
