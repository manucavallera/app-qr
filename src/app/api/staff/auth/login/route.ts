import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/http/client-ip";
import { apiErrorResponse } from "@/lib/api-errors";
import { AuthService, loginRateLimitKey, STAFF_SESSION_COOKIE, STAFF_SESSION_MAX_AGE_SECONDS } from "@/modules/auth/auth-service";
import { DomainError } from "@/modules/orders/errors";
import { sessionRepository } from "@/modules/auth/session-repository";

const loginBodySchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
});

const authService = new AuthService(sessionRepository);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = loginBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const ipAddress = getClientIp(request);
  const rateLimitKey = loginRateLimitKey(normalizedEmail, ipAddress);
  // Second bucket per email alone, so rotating the forwarded IP cannot lift the limit.
  const emailRateLimitKey = `staff-login-email:${normalizedEmail}`;

  try {
    const ipRateLimit = await sessionRepository.consumeRateLimit(rateLimitKey, 5, 15 * 60);
    const emailRateLimit = await sessionRepository.consumeRateLimit(emailRateLimitKey, 20, 15 * 60);
    const rateLimit = ipRateLimit.allowed ? emailRateLimit : ipRateLimit;
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetsAt.getTime() - Date.now()) / 1000));
      return NextResponse.json(
        { error: "TOO_MANY_ATTEMPTS" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const session = await authService.login(normalizedEmail, parsed.data.password);
    await sessionRepository.clearRateLimit(rateLimitKey);
    await sessionRepository.clearRateLimit(emailRateLimitKey);

    const response = NextResponse.json({
      id: session.user.id,
      displayName: session.user.displayName,
      role: session.user.role,
    });
    response.cookies.set(STAFF_SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STAFF_SESSION_MAX_AGE_SECONDS,
      expires: session.expiresAt,
    });
    return response;
  } catch (error) {
    if (error instanceof DomainError && error.code === "INVALID_CREDENTIALS") {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    return apiErrorResponse(error);
  }
}
