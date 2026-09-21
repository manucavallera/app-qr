import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("reports missing database configuration without echoing secrets", () => {
    const secret = "this-value-must-not-appear-in-errors";

    expect(() =>
      parseServerEnv({
        APP_URL: "http://localhost:3000",
        SESSION_SECRET: secret,
        PAYMENT_PROVIDER: "fake",
        IMAGE_STORAGE_DRIVER: "local",
      }),
    ).toThrow(/DATABASE_URL/);

    try {
      parseServerEnv({
        APP_URL: "http://localhost:3000",
        SESSION_SECRET: secret,
        PAYMENT_PROVIDER: "fake",
        IMAGE_STORAGE_DRIVER: "local",
      });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
