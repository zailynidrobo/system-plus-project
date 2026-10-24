/** Fecha actual inyectable: las pruebas usan un reloj fijo para revisar los plazos sin esperar días. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };
