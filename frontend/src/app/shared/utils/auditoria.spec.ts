import {
  aCsv,
  diaBogota,
  fechaHoraBogota,
  fechaHoraSegundosBogota,
  inicialesAuditoria,
  nombreAuditoria,
  numero,
  siglas,
  sumarDias,
  tonoAccion,
} from './auditoria';

describe('fechas de auditoría (hora de Bogotá)', () => {
  it('muestra la hora de Bogotá aunque el instante venga en UTC', () => {
    expect(fechaHoraBogota('2026-11-05T15:32:10.000Z')).toBe('05 nov 2026 · 10:32 a. m.');
  });

  it('pasada la medianoche UTC todavía es el día anterior en Bogotá', () => {
    expect(fechaHoraBogota('2026-11-06T03:30:00.000Z')).toBe('05 nov 2026 · 10:30 p. m.');
    expect(diaBogota('2026-11-06T03:30:00.000Z')).toBe('2026-11-05');
  });

  it('medianoche y mediodía se escriben como 12', () => {
    expect(fechaHoraBogota('2026-11-05T05:05:00.000Z')).toBe('05 nov 2026 · 12:05 a. m.');
    expect(fechaHoraBogota('2026-11-05T17:00:00.000Z')).toBe('05 nov 2026 · 12:00 p. m.');
  });

  it('sin fecha no muestra nada', () => {
    expect(fechaHoraBogota(null)).toBe('');
  });

  it('usa el correo cuando no hay nombre', () => {
    expect(nombreAuditoria({ name: null, email: 'intruso@example.com' })).toBe('intruso@example.com');
    expect(nombreAuditoria({ name: 'Laura Muñoz', email: 'l@example.com' })).toBe('Laura Muñoz');
    expect(nombreAuditoria({ name: null, email: null })).toBe('Usuario desconocido');
  });
});

describe('ayudas de la pantalla de auditoría', () => {
  it('muestra la hora con segundos y en 24 horas', () => {
    expect(fechaHoraSegundosBogota('2026-10-08T16:02:14.000Z')).toBe('08 oct 2026 · 11:02:14');
    expect(fechaHoraSegundosBogota('2026-10-08T14:58:40.000Z')).toBe('08 oct 2026 · 9:58:40');
    expect(fechaHoraSegundosBogota('2026-10-08T21:45:17.000Z')).toBe('08 oct 2026 · 16:45:17');
    expect(fechaHoraSegundosBogota('2026-10-08T05:00:03.000Z')).toBe('08 oct 2026 · 0:00:03');
  });

  it('separa los miles con punto', () => {
    expect(numero(1248)).toBe('1.248');
    expect(numero(38)).toBe('38');
    expect(numero(1234567)).toBe('1.234.567');
  });

  it('saca las siglas del módulo sin contar palabras sueltas', () => {
    expect(siglas('Programación Orientada a Objetos')).toBe('POO');
    expect(siglas('Bases de Datos')).toBe('BD');
    expect(siglas('Fundamentos')).toBe('Fundamentos');
    expect(siglas(null)).toBe('');
  });

  it('saca las iniciales del avatar, o las del correo si no hay nombre', () => {
    expect(inicialesAuditoria({ name: 'Laura Muñoz', email: null })).toBe('LM');
    expect(inicialesAuditoria({ name: 'Paola Andrea Valencia', email: null })).toBe('PV');
    expect(inicialesAuditoria({ name: null, email: 'intruso@example.com' })).toBe('IN');
  });

  it('colorea la acción según lo que hizo', () => {
    const e = (action: string, area = 'Guías base', result = 'success') => ({ action, area, result });
    expect(tonoAccion(e('Publicar guías'))).toBe('ok');
    expect(tonoAccion(e('Crear guías base'))).toBe('ok');
    expect(tonoAccion(e('Asignar roles', 'Usuarios y roles'))).toBe('warn');
    expect(tonoAccion(e('Inicio de sesión', 'Sesión'))).toBe('neutral');
    expect(tonoAccion(e('Enviar sugerencias sobre una guía', 'Sugerencias'))).toBe('base');
    expect(tonoAccion(e('Publicar guías', 'Guías base', 'denied'))).toBe('off');
  });

  it('suma días sin depender de la zona del navegador', () => {
    expect(sumarDias('2026-11-05', -29)).toBe('2026-10-07');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('arma el csv escapando comas y comillas', () => {
    const csv = aCsv(
      [
        {
          occurredAt: '2026-10-08T16:02:14.000Z',
          user: { name: 'Laura Muñoz', email: 'l@example.com', roleLabel: 'Coordinador Académico' },
          action: 'Aprobar sugerencias',
          area: 'Sugerencias',
          result: 'success',
          entity: { label: 'SUG-014 · "Guía", POO' },
          module: { name: 'Programación Orientada a Objetos' },
          ip: '192.168.10.24',
        },
      ],
      { success: 'Exitosa' },
    );
    const [titulos, fila] = csv.split('\r\n');
    expect(titulos.startsWith('Fecha y hora,Usuario,Correo,Rol,Acción')).toBe(true);
    expect(fila).toBe('08 oct 2026 · 11:02:14,Laura Muñoz,l@example.com,Coordinador Académico,Aprobar sugerencias,Sugerencias,"SUG-014 · ""Guía"", POO",Programación Orientada a Objetos,192.168.10.24,Exitosa');
  });
});
