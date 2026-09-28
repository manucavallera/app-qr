import { describe, expect, it, vi, beforeEach } from "vitest";
import { closeExpiredSessions } from "./session-cleanup";
import { prisma } from "../../lib/db";
import { resolveServiceMode } from "../operations/service-mode";

vi.mock("../../lib/db", () => ({
  prisma: {
    businessSettings: { findUnique: vi.fn() },
    serviceWindow: { findMany: vi.fn() },
    customerSession: { updateMany: vi.fn() },
  },
}));

vi.mock("../operations/service-mode", () => ({
  resolveServiceMode: vi.fn(),
}));

describe("closeExpiredSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.businessSettings.findUnique).mockResolvedValue({
      id: "default",
      name: "Test Bar",
      timezone: "America/Argentina/Buenos_Aires",
      manualMode: "SCHEDULED",
      locationUrl: null,
      instagramUrl: null,
      whatsappUrl: null,
      updatedAt: new Date(),
    });
    vi.mocked(prisma.serviceWindow.findMany).mockResolvedValue([]);
  });

  it("returns 0 if business settings are not found", async () => {
    vi.mocked(prisma.businessSettings.findUnique).mockResolvedValue(null);
    const result = await closeExpiredSessions(new Date());
    expect(result.closed).toBe(0);
    expect(prisma.customerSession.updateMany).not.toHaveBeenCalled();
  });

  it("returns 0 and does not close sessions if mode is QR_OPEN", async () => {
    vi.mocked(resolveServiceMode).mockReturnValue("QR_OPEN");
    const result = await closeExpiredSessions(new Date());
    expect(result.closed).toBe(0);
    expect(prisma.customerSession.updateMany).not.toHaveBeenCalled();
  });

  it("closes idle sessions if mode is COUNTER_ONLY", async () => {
    vi.mocked(resolveServiceMode).mockReturnValue("COUNTER_ONLY");
    vi.mocked(prisma.customerSession.updateMany).mockResolvedValue({ count: 5 });

    const now = new Date("2026-09-28T00:00:00Z");
    const result = await closeExpiredSessions(now);

    expect(result.closed).toBe(5);
    expect(prisma.customerSession.updateMany).toHaveBeenCalledWith({
      where: {
        closedAt: null,
        expiresAt: { gt: now },
        createdAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) },
        orders: { none: { status: { in: ["AWAITING_PAYMENT", "CONFIRMED", "PREPARING", "READY"] } } },
      },
      data: { closedAt: now },
    });
  });
});
