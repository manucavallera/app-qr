import { NextResponse, type NextRequest } from "next/server";
import { isCrossSiteWrite } from "./lib/security/csrf";

const STAFF_SESSION_COOKIE = "staff_session";

/**
 * Runs before every API and staff request.
 * - Blocks state-changing API calls that a browser sends from another site.
 * - Sends visitors without a staff cookie to the login page. The cookie is
 *   only checked for presence here; every staff API still validates it.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const crossSite = isCrossSiteWrite({
      method: request.method,
      origin: request.headers.get("origin"),
      host: request.headers.get("host"),
      fetchSite: request.headers.get("sec-fetch-site"),
      appUrl: process.env.APP_URL,
    });
    if (crossSite) return NextResponse.json({ error: "CSRF_ORIGIN_MISMATCH" }, { status: 403 });
    return NextResponse.next();
  }

  if (pathname !== "/staff/login" && !request.cookies.has(STAFF_SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/staff/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // The Mercado Pago webhook is a server-to-server call verified by its signature.
  matcher: ["/api/((?!payments/mercado-pago/webhook).*)", "/staff/:path*"],
};
