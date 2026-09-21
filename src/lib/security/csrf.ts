export function isAllowedOrigin(origin: string | null, appUrl: string): boolean {
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(appUrl).origin; } catch { return false; }
}

export function assertAllowedOrigin(origin: string | null, appUrl: string): void {
  if (!isAllowedOrigin(origin, appUrl)) { const error = new Error("Origin no permitido"); (error as Error & { code: string }).code = "CSRF_ORIGIN_MISMATCH"; throw error; }
}
