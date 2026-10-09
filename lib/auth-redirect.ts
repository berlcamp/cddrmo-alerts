export const DEFAULT_ADMIN_PATH = '/admin';

export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/admin') || next.startsWith('//') || next.includes('\\')) return DEFAULT_ADMIN_PATH;
  return next;
}
