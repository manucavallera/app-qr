import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/ready/route";
describe("readiness", () => { it("checks the database", async () => { const response = await GET(); expect(response.status).toBe(200); await expect(response.json()).resolves.toMatchObject({ status: "ready" }); }); });
