import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/modules/orders/errors";

const domainStatus: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  PRODUCT_NOT_FOUND: 404,
  CATEGORY_NOT_FOUND: 404,
  TABLE_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  QR_ORDERING_CLOSED: 409,
  PRICE_CHANGED: 409,
  PRODUCT_UNAVAILABLE: 409,
  OPTION_UNAVAILABLE: 409,
  ORDER_REQUEST_CONFLICT: 409,
  ORDER_VERSION_CONFLICT: 409,
  ORDER_NOT_AWAITING_PAYMENT: 409,
  PAYMENT_METHOD_MISMATCH: 409,
  PAYMENT_METHOD_UNAVAILABLE: 409,
  PAYMENT_NOT_FOUND: 404,
  FORBIDDEN: 403,
  CUSTOMER_SESSION_EXPIRED: 401,
  ORDER_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  LAST_ADMIN: 409,
  ADMIN_REQUIRED_TO_CANCEL_IN_PREPARATION: 403,
  CANCELLATION_REASON_REQUIRED: 400,
  INVALID_ORDER_TRANSITION: 409,
};

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  if (error instanceof DomainError) {
    if (error.code === "PRICE_CHANGED" && error.details?.quote) {
      return NextResponse.json({ error: error.code, quote: error.details.quote }, { status: 409 });
    }
    return NextResponse.json(
      { error: error.code },
      { status: domainStatus[error.code] ?? 400 },
    );
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "P2002") return NextResponse.json({ error: "ALREADY_EXISTS" }, { status: 409 });
    if (code === "P2025") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
}
