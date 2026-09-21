import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_TTL_SECONDS, customerSessionService } from "@/modules/tables/customer-session-service";

type RouteContext = { params: Promise<{ qrToken: string }> };

function getClientIp(request: NextRequest): string {
  return (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 120);
}
export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { qrToken } = await params;
  const principal = await customerSessionService.authenticate(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value, qrToken);
  if (!principal) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return NextResponse.json({ nickname: principal.nickname });
}

export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { qrToken } = await params;
  const body: unknown = await request.json().catch(() => null);
  try {
    const nickname = typeof body === "object" && body !== null && "nickname" in body
      ? (body as { nickname: unknown }).nickname
      : undefined;
    const session = await customerSessionService.create(qrToken, nickname, getClientIp(request));
    const response = NextResponse.json({ nickname: session.principal.nickname }, { status: 201 });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CUSTOMER_SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
