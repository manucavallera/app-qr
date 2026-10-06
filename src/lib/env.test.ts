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

  it("drops trailing slashes from APP_URL so built links do not contain //", () => {
    const base = { DATABASE_URL: "postgresql://u:p@localhost:5432/db", SESSION_SECRET: "x".repeat(32), PAYMENT_PROVIDER: "fake", IMAGE_STORAGE_DRIVER: "local" };
    expect(parseServerEnv({ ...base, APP_URL: "https://bar.example.com/" }).APP_URL).toBe("https://bar.example.com");
    expect(parseServerEnv({ ...base, APP_URL: "https://bar.example.com///" }).APP_URL).toBe("https://bar.example.com");
    expect(parseServerEnv({ ...base, APP_URL: "http://localhost:3000" }).APP_URL).toBe("http://localhost:3000");
  });
});
