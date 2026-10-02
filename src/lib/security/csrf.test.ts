import { describe, expect, it } from "vitest";
import { isAllowedOrigin, isCrossSiteWrite } from "./csrf";

describe("CSRF origin", () => {
  it("allows the configured app origin and rejects another site", () => {
    expect(isAllowedOrigin("https://bar.test", "https://bar.test")).toBe(true);
    expect(isAllowedOrigin("https://evil.test", "https://bar.test")).toBe(false);
  });

  it("blocks browser writes from another site and lets same-site and non-browser calls through", () => {
    const base = { method: "POST", host: "bar.test", fetchSite: null, appUrl: "https://bar.test" };
    expect(isCrossSiteWrite({ ...base, origin: "https://evil.test" })).toBe(true);
    expect(isCrossSiteWrite({ ...base, origin: "https://bar.test", fetchSite: "cross-site" })).toBe(true);
    expect(isCrossSiteWrite({ ...base, origin: "not a url" })).toBe(true);
    expect(isCrossSiteWrite({ ...base, origin: "https://bar.test" })).toBe(false);
    expect(isCrossSiteWrite({ ...base, origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" })).toBe(false);
    expect(isCrossSiteWrite({ ...base, origin: null })).toBe(false);
    expect(isCrossSiteWrite({ ...base, method: "GET", origin: "https://evil.test" })).toBe(false);
  });
});
