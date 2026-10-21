import { randomInt } from 'node:crypto';

// Sin caracteres que se confunden al leerlos (0/O, 1/l/I) porque la contraseña se entrega a mano.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!#$%*?';

/** Contraseña aleatoria con mayúscula, minúscula, número y símbolo (cumple políticas habituales). */
export function generateTemporaryPassword(length = 12): string {
  const pick = (set: string) => set[randomInt(set.length)];
  const all = UPPER + LOWER + DIGITS + SPECIAL;

  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  while (chars.length < length) chars.push(pick(all));

  // Mezcla (Fisher-Yates) para que los caracteres obligatorios no queden siempre al inicio
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
