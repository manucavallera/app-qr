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

type ProductSeed = {
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  station: "GENERAL" | "KITCHEN" | "BAR";
  fulfillment: "TABLE" | "PICKUP";
  sortOrder: number;
};

async function ensureProduct(product: ProductSeed) {
  const existing = await prisma.product.findFirst({
    where: { categoryId: product.categoryId, name: product.name },
  });

  if (!existing) {
    await prisma.product.create({ data: product });
  }
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
  const sides = await ensureCategory("Para compartir", 1);
  const drinks = await ensureCategory("Bebidas", 2);

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

  await ensureProduct({
    categoryId: burgers.id,
    name: "Hamburguesa vegetariana",
    description: "Medallón de vegetales, queso, rúcula y tomate.",
    priceCents: 890000,
    station: "KITCHEN",
    fulfillment: "TABLE",
    sortOrder: 1,
  });

  await ensureProduct({
    categoryId: sides.id,
    name: "Papas clásicas",
    description: "Papas doradas con sal y especias de la casa.",
    priceCents: 450000,
    station: "KITCHEN",
    fulfillment: "TABLE",
    sortOrder: 0,
  });

  await ensureProduct({
    categoryId: sides.id,
    name: "Papas con cheddar",
    description: "Papas doradas con cheddar y verdeo.",
    priceCents: 550000,
    station: "KITCHEN",
    fulfillment: "TABLE",
    sortOrder: 1,
  });

  await ensureProduct({
    categoryId: drinks.id,
    name: "Cerveza tirada",
    description: "Vaso de cerveza rubia tirada bien fría.",
    priceCents: 380000,
    station: "BAR",
    fulfillment: "TABLE",
    sortOrder: 1,
  });

  await ensureProduct({
    categoryId: drinks.id,
    name: "Gaseosa",
    description: "Gaseosa fría de 500 ml.",
    priceCents: 280000,
    station: "BAR",
    fulfillment: "TABLE",
    sortOrder: 2,
  });

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
