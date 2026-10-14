import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideAuth } from './core/auth/provide-auth';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { environment } from '../environments/environment';
import { HttpUserApi } from './features/users/http-user-api';
import { UserApi } from './features/users/user-api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAuth(),
    // HE-01: con api = 'http' las pantallas de usuarios hablan con el backend; si no, con el mock.
    ...(environment.api === 'http' ? [{ provide: UserApi, useClass: HttpUserApi }] : []),
  ],
};