// Error que devuelven los servicios (mock o API). `message` es igual a `code`,
// así las pantallas de HE-01 que comparan err.message siguen funcionando.
export class ApiError<T = unknown> extends Error {
  constructor(
    readonly code: string,
    readonly data?: T,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}
