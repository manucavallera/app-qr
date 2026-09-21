import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/modules/orders/errors";

const domainStatus: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  PRODUCT_NOT_FOUND: 404,
  CATEGORY_NOT_FOUND: 404,
  TABLE_NOT_FOUND: 404,
  RATE_LIMITED: 429,
};

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  if (error instanceof DomainError) {
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
