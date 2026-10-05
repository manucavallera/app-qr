import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/modules/auth/password";
import { createSupply, listLowSupplies, registerSupplyMovement, updateSupply } from "@/modules/supplies/supply-service";

const unique = randomUUID();
let actorId = "";
const supplyIds: string[] = [];

async function newSupply(input: { quantity?: number; minQuantity?: number } = {}) {
  const supply = await createSupply({ name: `Insumo ${randomUUID()}`, unit: "GRAM", ...input }, actorId);
  supplyIds.push(supply.id);
  return supply;
}

describe("supplies", () => {
  beforeAll(async () => {
    const user = await prisma.staffUser.create({ data: { email: `supplies-${unique}@local.test`, displayName: "Insumos", passwordHash: await hashPassword("integration password"), role: "ADMIN" } });
    actorId = user.id;
  });

  afterAll(async () => {
    await prisma.supply.deleteMany({ where: { id: { in: supplyIds } } });
    await prisma.auditEvent.deleteMany({ where: { actorStaffId: actorId } });
    await prisma.staffUser.deleteMany({ where: { id: actorId } });
  });

  it("creates a supply with its starting stock recorded as a movement", async () => {
    const supply = await newSupply({ quantity: 5000, minQuantity: 1000 });

    expect(supply).toMatchObject({ unit: "GRAM", quantity: 5000, minQuantity: 1000, active: true, low: false });
    expect(await prisma.supplyMovement.findMany({ where: { supplyId: supply.id } })).toMatchObject([{ delta: 5000, reason: "ADJUSTMENT" }]);
  });

  it("adds purchases, removes waste and sets a manual count", async () => {
    const supply = await newSupply({ quantity: 1000 });

    expect((await registerSupplyMovement(supply.id, { reason: "PURCHASE", quantity: 2500 }, actorId)).quantity).toBe(3500);
    expect((await registerSupplyMovement(supply.id, { reason: "WASTE", quantity: 500, note: "Se venció" }, actorId)).quantity).toBe(3000);
    expect((await registerSupplyMovement(supply.id, { reason: "ADJUSTMENT", newQuantity: 2800 }, actorId)).quantity).toBe(2800);

    const deltas = (await prisma.supplyMovement.findMany({ where: { supplyId: supply.id }, orderBy: { createdAt: "asc" } })).map((row) => row.delta);
    expect(deltas).toEqual([1000, 2500, -500, -200]);
  });

  it("refuses waste larger than the stock and keeps the quantity", async () => {
    const supply = await newSupply({ quantity: 100 });

    await expect(registerSupplyMovement(supply.id, { reason: "WASTE", quantity: 101 }, actorId)).rejects.toMatchObject({ code: "INSUFFICIENT_SUPPLY" });
    expect((await prisma.supply.findUniqueOrThrow({ where: { id: supply.id } })).quantity).toBe(100);
  });

  it("never lets concurrent waste take the stock below zero", async () => {
    const supply = await newSupply({ quantity: 100 });

    const results = await Promise.allSettled(Array.from({ length: 5 }, () => registerSupplyMovement(supply.id, { reason: "WASTE", quantity: 30 }, actorId)));

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect((await prisma.supply.findUniqueOrThrow({ where: { id: supply.id } })).quantity).toBe(10);
  });

  it("flags active supplies at or below the minimum and ignores inactive ones", async () => {
    const low = await newSupply({ quantity: 100, minQuantity: 100 });
    const fine = await newSupply({ quantity: 101, minQuantity: 100 });
    const off = await newSupply({ quantity: 0, minQuantity: 100 });
    await updateSupply(off.id, { active: false }, actorId);

    const ids = (await listLowSupplies()).map((supply) => supply.id);

    expect(ids).toContain(low.id);
    expect(ids).not.toContain(fine.id);
    expect(ids).not.toContain(off.id);
  });

  it("rejects duplicate names, unknown supplies and invalid quantities", async () => {
    const supply = await newSupply();

    await expect(createSupply({ name: supply.name, unit: "UNIT" }, actorId)).rejects.toMatchObject({ code: "SUPPLY_NAME_TAKEN" });
    await expect(registerSupplyMovement(randomUUID(), { reason: "PURCHASE", quantity: 1 }, actorId)).rejects.toMatchObject({ code: "SUPPLY_NOT_FOUND" });
    await expect(registerSupplyMovement(supply.id, { reason: "PURCHASE", quantity: 0 }, actorId)).rejects.toThrow();
    await expect(registerSupplyMovement(supply.id, { reason: "ADJUSTMENT", newQuantity: -1 }, actorId)).rejects.toThrow();
  });
});
