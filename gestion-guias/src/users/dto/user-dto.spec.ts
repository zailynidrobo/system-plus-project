import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';
import { UpdateUserDto } from './update-user.dto.js';

const errores = async (cls: new () => object, data: object) =>
  (await validate(plainToInstance(cls, data))).map((error) => error.property);

describe('DTO de usuarios: nombre completo', () => {
  it('rechaza un nombre sin apellido al crear', async () => {
    expect(
      await errores(CreateUserDto, { name: 'admin2', email: 'a@example.com' }),
    ).toContain('name');
  });

  it('acepta nombre y apellido al crear', async () => {
    expect(
      await errores(CreateUserDto, {
        name: 'Ana Gómez',
        email: 'a@example.com',
      }),
    ).toEqual([]);
  });

  it('rechaza un nombre sin apellido al editar', async () => {
    expect(await errores(UpdateUserDto, { name: 'Ana' })).toContain('name');
  });
  it('rechaza un nombre de más de 100 caracteres (DEF-03)', async () => {
    const largo = 'Ana ' + 'x'.repeat(120);
    expect(await errores(CreateUserDto, { name: largo, email: 'a@example.com', role: 'docente' })).toContain('name');
    expect(await errores(UpdateUserDto, { name: largo })).toContain('name');
  });
});
