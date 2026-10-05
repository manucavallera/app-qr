import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { getClientIp } from "./client-ip";

function requestWith(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/x", { headers });
}

describe("getClientIp", () => {
  it("usa el último valor, el que agrega el proxy", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": "10.9.8.7, 203.0.113.5" }))).toBe("203.0.113.5");
  });
  it("acepta un solo valor", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": "203.0.113.5" }))).toBe("203.0.113.5");
  });
  it("cae a x-real-ip y luego a unknown", () => {
    expect(getClientIp(requestWith({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(getClientIp(requestWith({}))).toBe("unknown");
  });
});
