export function isAllowedOrigin(origin: string | null, appUrl: string): boolean {
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(appUrl).origin; } catch { return false; }
}

export function assertAllowedOrigin(origin: string | null, appUrl: string): void {
  if (!isAllowedOrigin(origin, appUrl)) { const error = new Error("Origin no permitido"); (error as Error & { code: string }).code = "CSRF_ORIGIN_MISMATCH"; throw error; }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * True when a browser is sending a state-changing request from another site.
 * Requests without an Origin header come from non-browser clients (cron, curl),
 * which cannot carry a victim's cookies, so they are not treated as CSRF.
 */
export function isCrossSiteWrite(input: { method: string; origin: string | null; host: string | null; fetchSite: string | null; appUrl: string | undefined }): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return false;
  if (input.fetchSite === "cross-site") return true;
  if (!input.origin) return false;
  if (input.appUrl && isAllowedOrigin(input.origin, input.appUrl)) return false;
  try { return new URL(input.origin).host !== input.host; } catch { return true; }
}
