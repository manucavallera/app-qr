import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./csrf";
describe("CSRF origin", () => { it("allows the configured app origin and rejects another site", () => { expect(isAllowedOrigin("https://bar.test", "https://bar.test")).toBe(true); expect(isAllowedOrigin("https://evil.test", "https://bar.test")).toBe(false); }); });
