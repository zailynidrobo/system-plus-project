import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GuideField } from '../../models/guide-field';
import { DynamicForm } from './dynamic-form';

const CAMPOS: GuideField[] = [
  { key: 'evaluacion', label: 'Tipo de evaluación', type: 'select', required: true, options: ['Por evidencias', 'Por proyecto', 'Mixta'] },
  { key: 'objetivos', label: 'Objetivos', type: 'textarea', required: true, maxLength: 500 },
  { key: 'recursos', label: 'Recursos', type: 'textarea', required: false },
];

describe('DynamicForm (formulario generado desde la estructura)', () => {
  let fixture: ComponentFixture<DynamicForm>;
  let form: DynamicForm;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DynamicForm] }).compileComponents();
    fixture = TestBed.createComponent(DynamicForm);
    fixture.componentRef.setInput('fields', CAMPOS);
    fixture.componentRef.setInput('valores', { objetivos: 'Diseñar clases' });
    fixture.detectChanges();
    form = fixture.componentInstance;
  });

  it('crea un control por campo con los valores iniciales y no admite claves fuera de la estructura', () => {
    expect(form.valor()).toEqual({ evaluacion: null, objetivos: 'Diseñar clases', recursos: null });
  });

  it('valida los campos obligatorios', () => {
    expect(form.validar()).toBe(false);
    form.elegir(CAMPOS[0], 'Mixta');
    expect(form.validar()).toBe(true);
  });

  it('muestra las listas cortas como botones y marca los campos modificados', () => {
    fixture.componentRef.setInput('original', { evaluacion: null, objetivos: 'Diseñar clases', recursos: null });
    form.elegir(CAMPOS[0], 'Por proyecto');
    fixture.detectChanges();

    const chips = fixture.nativeElement.querySelectorAll('.ui-chip');
    expect(chips).toHaveLength(3);
    expect(form.modificado('evaluacion')).toBe(true);
    expect(form.modificado('objetivos')).toBe(false);
  });

  it('los campos bloqueados no se pueden editar', () => {
    const otro = TestBed.createComponent(DynamicForm);
    otro.componentRef.setInput('fields', CAMPOS);
    otro.componentRef.setInput('bloqueados', ['evaluacion']);
    otro.detectChanges();

    otro.componentInstance.elegir(CAMPOS[0], 'Mixta');
    expect(otro.componentInstance.valor()['evaluacion']).toBeNull();
  });
});
