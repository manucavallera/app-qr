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

const burgerOptionGroups = [
  {
    name: "Extras",
    required: false,
    minSelections: 0,
    maxSelections: 1,
    sortOrder: 0,
    values: [{ name: "Medallón extra", priceDeltaCents: 250000, sortOrder: 0 }],
  },
  {
    name: "Sacar",
    required: false,
    minSelections: 0,
    maxSelections: 4,
    sortOrder: 1,
    values: [
      { name: "Sin queso", priceDeltaCents: 0, sortOrder: 0 },
      { name: "Sin lechuga", priceDeltaCents: 0, sortOrder: 1 },
      { name: "Sin tomate", priceDeltaCents: 0, sortOrder: 2 },
      { name: "Sin mayonesa", priceDeltaCents: 0, sortOrder: 3 },
    ],
  },
];

// Smash burgers have no cooking point: drop the old demo group and make sure
// the extras and "remove ingredient" groups exist. Groups edited from the
// staff panel are left untouched.
async function ensureBurgerOptions(categoryId: string, name: string) {
  const burger = await prisma.product.findFirst({
    where: { categoryId, name },
    include: { optionGroups: { select: { name: true } } },
  });
  if (!burger) return;

  // Refresh only the untouched demo descriptions so they match the new options.
  await prisma.product.updateMany({
    where: { id: burger.id, description: { in: ["Medallón de carne, queso, lechuga y tomate.", "Medallón de vegetales, queso, rúcula y tomate."] } },
    data: { description: name === "Hamburguesa clásica" ? "Medallón smash, queso, lechuga, tomate y mayonesa." : "Medallón de vegetales, queso, lechuga, tomate y mayonesa." },
  });

  await prisma.optionGroup.deleteMany({ where: { productId: burger.id, name: "Punto de cocción" } });
  for (const { values, ...group } of burgerOptionGroups) {
    if (burger.optionGroups.some((existing) => existing.name === group.name)) continue;
    await prisma.optionGroup.create({
      data: { ...group, productId: burger.id, values: { create: values } },
    });
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

  await ensureProduct({
    categoryId: burgers.id,
    name: "Hamburguesa clásica",
    description: "Medallón smash, queso, lechuga, tomate y mayonesa.",
    priceCents: 950000,
    station: "KITCHEN",
    fulfillment: "TABLE",
    sortOrder: 0,
  });

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
    description: "Medallón de vegetales, queso, lechuga, tomate y mayonesa.",
    priceCents: 890000,
    station: "KITCHEN",
    fulfillment: "TABLE",
    sortOrder: 1,
  });

  await ensureBurgerOptions(burgers.id, "Hamburguesa clásica");
  await ensureBurgerOptions(burgers.id, "Hamburguesa vegetariana");

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
