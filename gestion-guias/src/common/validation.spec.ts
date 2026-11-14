import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { crearValidationPipe } from './validation.js';

class Ejemplo {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() @MaxLength(2000, { message: 'La descripción admite máximo 2000 caracteres' }) description!: string;
}

async function errores(body: object): Promise<string[]> {
  try {
    await crearValidationPipe().transform(body, { type: 'body', metatype: Ejemplo });
    return [];
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    return ((e as BadRequestException).getResponse() as { message: string[] }).message;
  }
}

describe('Mensajes de validación en español (DEF-10, RNF-15)', () => {
  it('traduce los mensajes por defecto e indica el campo', async () => {
    const m = await errores({ name: '', email: 'no-es-correo', description: 'ok' });
    expect(m).toEqual(['El campo nombre es obligatorio', 'El campo correo electrónico no tiene un formato de correo válido']);
  });

  it('da un solo mensaje por campo, empezando por lo más básico', async () => {
    const m = await errores({ name: 'Ana Ruiz', email: 'ana@example.com' });
    expect(m).toEqual(['El campo descripción es obligatorio']);
  });

  it('conserva los mensajes propios que ya están en español', async () => {
    const m = await errores({ name: 'Ana Ruiz', email: 'ana@example.com', description: 'x'.repeat(2001) });
    expect(m).toEqual(['La descripción admite máximo 2000 caracteres']);
  });

  it('no responde nada en inglés', async () => {
    const m = await errores({});
    expect(m.join(' ')).not.toMatch(/should|must be|each value/);
  });
});
