import { describe, expect, it } from "vitest";
import { securityHeaders } from "./headers";

describe("security headers", () => {
  it("allows the development toolchain to inject styles and reconstruct callstacks", () => {
    const policy = securityHeaders(false)["Content-Security-Policy"];

    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("keeps eval disabled in production", () => {
    const policy = securityHeaders(true)["Content-Security-Policy"];

    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  });
});
