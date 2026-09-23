import "dotenv/config";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";

function getAdminCredentials(): { email: string; password: string } {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required to seed the admin user.");
  }

  return { email, password };
}

async function ensureCategory(name: string, sortOrder: number) {
  const existing = await prisma.category.findFirst({ where: { name } });
  return (
    existing ??
    prisma.category.create({
      data: { name, sortOrder },
    })
  );
}

async function seed() {
  const { email: adminEmail, password: adminPassword } = getAdminCredentials();

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      name: "Bar de hamburguesas",
      locationUrl: null,
      instagramUrl: null,
      whatsappUrl: null,
    },
    update: {},
  });

  await prisma.paymentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      mercadoPagoEnabled: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
      cashEnabled: true,
      cardAtCounterEnabled: true,
      bankTransferEnabled: false,
    },
    update: {},
  });

  await prisma.serviceWindow.deleteMany({ where: { weekday: 0 } });
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await prisma.serviceWindow.upsert({
      where: { weekday },
      create: {
        weekday,
        opensAtMinute: 0,
        closesAtMinute: 0,
        enabled: false,
      },
      update: {},
    });
  }

  const burgers = await ensureCategory("Hamburguesas", 0);
  const drinks = await ensureCategory("Bebidas", 1);

  const existingBurger = await prisma.product.findFirst({
    where: { categoryId: burgers.id, name: "Hamburguesa clásica" },
  });
  if (!existingBurger) {
    await prisma.product.create({
      data: {
        categoryId: burgers.id,
        name: "Hamburguesa clásica",
        description: "Medallón de carne, queso, lechuga y tomate.",
        priceCents: 950000,
        station: "KITCHEN",
        fulfillment: "TABLE",
        sortOrder: 0,
        optionGroups: {
          create: {
            name: "Punto de cocción",
            required: true,
            minSelections: 1,
            maxSelections: 1,
            values: {
              create: [
                { name: "Jugosa", sortOrder: 0 },
                { name: "A punto", sortOrder: 1 },
                { name: "Bien cocida", sortOrder: 2 },
              ],
            },
          },
        },
      },
    });
  }

  const existingDrink = await prisma.product.findFirst({
    where: { categoryId: drinks.id, name: "Limonada" },
  });
  if (!existingDrink) {
    await prisma.product.create({
      data: {
        categoryId: drinks.id,
        name: "Limonada",
        description: "Limonada fresca de la casa.",
        priceCents: 320000,
        station: "BAR",
        fulfillment: "PICKUP",
        sortOrder: 0,
      },
    });
  }

  for (let tableNumber = 1; tableNumber <= 10; tableNumber += 1) {
    const label = `Mesa ${tableNumber}`;
    const existingTable = await prisma.diningTable.findUnique({ where: { label } });
    if (!existingTable) {
      await prisma.diningTable.create({
        data: {
          label,
          qrToken: randomBytes(24).toString("base64url"),
        },
      });
    }
  }

  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  await prisma.staffUser.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      displayName: "Administración",
      passwordHash,
      role: "ADMIN",
    },
    update: {
      passwordHash,
      role: "ADMIN",
      active: true,
    },
  });
}

seed()
  .catch((error: unknown) => {
    console.error("Database seed failed.", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
