import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { UserForm } from './user-form';

describe('UserForm', () => {
  let component: UserForm;
  let fixture: ComponentFixture<UserForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserForm],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(UserForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exige nombre y apellido', () => {
    const nombre = component.form.controls.nombre;
    nombre.markAsTouched();

    nombre.setValue('admin2');
    expect(nombre.valid).toBe(false);
    expect(component.mensajeNombre()).toBe('Escribe nombre y apellido.');

    nombre.setValue('  Ana   Gómez ');
    expect(nombre.valid).toBe(true);
  });
});
