import { getClientIp } from "@/lib/http/client-ip";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_TTL_SECONDS, customerSessionService } from "@/modules/tables/customer-session-service";

type RouteContext = { params: Promise<{ qrToken: string }> };

export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { qrToken } = await params;
  const principal = await customerSessionService.authenticate(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value, qrToken);
  // Without a session, say who is already at the table so a returning customer can continue as themselves.
  if (!principal) return NextResponse.json({ nickname: null, people: await customerSessionService.listRejoinable(qrToken) });
  return NextResponse.json({ nickname: principal.nickname });
}

export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { qrToken } = await params;
  const body: unknown = await request.json().catch(() => null);
  try {
    const nickname = typeof body === "object" && body !== null && "nickname" in body
      ? (body as { nickname: unknown }).nickname
      : undefined;
    const rejoin = typeof body === "object" && body !== null && (body as { rejoin?: unknown }).rejoin === true;
    const session = await customerSessionService.create(qrToken, nickname, getClientIp(request), new Date(), rejoin);
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
