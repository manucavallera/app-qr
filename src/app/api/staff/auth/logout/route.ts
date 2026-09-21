import { NextRequest, NextResponse } from "next/server";
import { AuthService, STAFF_SESSION_COOKIE } from "@/modules/auth/auth-service";
import { sessionRepository } from "@/modules/auth/session-repository";

const authService = new AuthService(sessionRepository);

export async function POST(request: NextRequest): Promise<NextResponse> {
  await authService.logout(request.cookies.get(STAFF_SESSION_COOKIE)?.value);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
