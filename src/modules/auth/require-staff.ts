import { NextRequest, NextResponse } from "next/server";
import {
  AuthService,
  STAFF_SESSION_COOKIE,
  type StaffPrincipal,
  type StaffRole,
} from "./auth-service";
import { sessionRepository } from "./session-repository";

export type { StaffPrincipal } from "./auth-service";

const staffAuthService = new AuthService(sessionRepository);

export async function requireStaff(
  request: NextRequest,
  roles: readonly StaffRole[],
  authService: AuthService = staffAuthService,
): Promise<StaffPrincipal | NextResponse> {
  const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const principal = await authService.authenticate(token);

  if (!principal) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (!roles.includes(principal.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  return principal;
}
