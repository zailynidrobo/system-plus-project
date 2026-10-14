import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../../shared/models/api-error';
import { UserApi } from '../user-api';

import { UserList } from './user-list';

describe('UserList', () => {
  let component: UserList;
  let fixture: ComponentFixture<UserList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserList],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(UserList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('UserList cuando el backend falla', () => {
  it('muestra un aviso en vez de quedarse cargando y permite reintentar', async () => {
    let llamadas = 0;
    const api = {
      listar: () => {
        llamadas++;
        return llamadas === 1
          ? throwError(() => new ApiError('ERROR_DE_SERVIDOR'))
          : of({ items: [], total: 0 });
      },
      resumen: () => throwError(() => new ApiError('ERROR_DE_SERVIDOR')),
    };
    TestBed.configureTestingModule({
      imports: [UserList],
      providers: [provideRouter([]), { provide: UserApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(UserList);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('No se pudieron cargar los usuarios');
    expect(el.textContent).not.toContain('Cargando usuarios');

    el.querySelector<HTMLButtonElement>('button.retry')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(llamadas).toBe(2);
    expect(el.textContent).not.toContain('No se pudieron cargar los usuarios');
  });
});
