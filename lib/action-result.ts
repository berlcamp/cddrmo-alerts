export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; message: string; retryable: boolean };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(message: string, retryable = false): { ok: false; message: string; retryable: boolean } {
  return { ok: false, message, retryable };
}
