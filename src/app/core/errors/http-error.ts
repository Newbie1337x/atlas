import { HttpErrorResponse } from '@angular/common/http';

/**
 * Typed error surface for the app. Every HTTP failure that reaches a feature
 * or component is an HttpError (transformed by error-transform.interceptor).
 * Features NEVER see HttpErrorResponse directly — the shape is stable and
 * the message is safe to surface to the user.
 */
export class HttpError extends Error {
  constructor(
    /** HTTP status. 0 for network / offline. */
    public readonly status: number,
    /** Backend error code when Proteus emits one, else 'HTTP_<status>'. */
    public readonly code: string,
    /** User-facing message in Spanish, safe to display. */
    public readonly userMessage: string,
    /** Raw body when useful for debugging. */
    public readonly raw?: unknown,
  ) {
    super(`[${code}] ${userMessage}`);
    this.name = 'HttpError';
  }

  get isOffline():   boolean { return this.status === 0; }
  get isAuth():      boolean { return this.status === 401 || this.status === 403; }
  get isNotFound():  boolean { return this.status === 404; }
  get isConflict():  boolean { return this.status === 409; }
  get isValidation():boolean { return this.status === 400 || this.status === 422; }
  get isServer():    boolean { return this.status >= 500; }
}

/**
 * Transforms an HttpErrorResponse into an HttpError with a friendly Spanish
 * message. Proteus returns `{ error: 'CODE', message: '...' }` when it can;
 * we fall back to generic messages for anything else.
 */
export function toHttpError(res: HttpErrorResponse): HttpError {
  const body = res.error as { error?: string; message?: string; code?: string } | null;

  const code =
    body?.code   ??
    body?.error  ??
    (res.status === 0 ? 'OFFLINE' : `HTTP_${res.status}`);

  const backendMsg = typeof body?.message === 'string' ? body.message : null;
  const userMessage = backendMsg ?? defaultMessageFor(res.status);

  return new HttpError(res.status, code, userMessage, body);
}

function defaultMessageFor(status: number): string {
  if (status === 0)   return 'Sin conexión. Revisá tu internet.';
  if (status === 400) return 'Los datos enviados no son válidos.';
  if (status === 401) return 'Necesitás ingresar de nuevo.';
  if (status === 403) return 'No tenés permiso para esta acción.';
  if (status === 404) return 'No lo encontramos.';
  if (status === 409) return 'Hay un conflicto con datos existentes.';
  if (status === 422) return 'Faltan datos o son inválidos.';
  if (status === 429) return 'Muchos intentos. Esperá un momento.';
  if (status >= 500)  return 'Tuvimos un problema. Estamos revisándolo.';
  return 'Ocurrió un error inesperado.';
}
