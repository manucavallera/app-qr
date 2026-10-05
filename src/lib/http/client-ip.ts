import type { NextRequest } from "next/server";

/**
 * IP del cliente según el último valor de `x-forwarded-for`: el que agrega el proxy
 * de confianza. Los valores anteriores los controla el cliente y se pueden falsear.
 */
export function getClientIp(request: NextRequest): string {
  const hops = request.headers.get("x-forwarded-for")?.split(",").map((hop) => hop.trim()).filter(Boolean) ?? [];
  return (hops.at(-1) || request.headers.get("x-real-ip") || "unknown").slice(0, 120);
}
