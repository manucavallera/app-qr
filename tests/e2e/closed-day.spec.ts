import { collectBrowserErrors, expect, test } from "./fixtures";

test("un día sin horario muestra el local cerrado y no deja continuar con el pedido", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "El día cerrado se prueba una vez en escritorio.");
  const browserErrors = collectBrowserErrors(page);
  await page.route("**/api/public/qr/closed-token/session", (route) => route.fulfill({ json: { nickname: "Ana" } }));
  await page.route("**/api/public/menu/closed-token", (route) => route.fulfill({ json: {
    table: { label: "Mesa 1" },
    mode: "CLOSED",
    business: { name: "Bar", locationUrl: null, instagramUrl: null, whatsappUrl: null },
    service: { mode: "CLOSED", hoursLabel: null },
    categories: [{ id: "c1", name: "Hamburguesas", products: [{ id: "p1", name: "Hamburguesa clásica", description: "Medallón smash", priceCents: 950000, imageUrl: null, available: true, stockQuantity: null, lowStock: false, fulfillment: "TABLE", featured: false, optionGroups: [] }] }],
    payment: { methods: ["CASH"], unavailable: [], transfer: null },
    serverTime: new Date().toISOString(),
  } }));

  await page.goto("/m/closed-token");
  await expect(page.getByRole("heading", { name: "Elegí algo rico." })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("el local está cerrado");
  await expect(page.getByRole("status")).not.toContainText("barra o caja");
  await expect(page.getByText("Hamburguesa clásica")).toBeVisible();
  await page.getByRole("button", { name: /Agregar Hamburguesa clásica/ }).click();
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await page.getByRole("button", { name: /^Ver pedido, / }).click();
  await expect(page.getByText("Hoy el local está cerrado, así que no se toman pedidos.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar con el pedido" })).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
