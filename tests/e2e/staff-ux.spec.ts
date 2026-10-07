import { test, expect, withStaffCookie } from "./fixtures";

test.beforeEach(async ({ page, baseURL }) => {
  await withStaffCookie(page, baseURL);
});

test("Pedidos muestra historial, detalle y estados legibles", async ({ page }) => {
  await page.route("**/api/staff/orders", (route) => route.fulfill({ json: [{
    id: "order-1",
    number: 42,
    origin: "COUNTER",
    status: "CONFIRMED",
    version: 1,
    totalCents: 125000,
    createdAt: new Date().toISOString(),
    table: { label: "Mesa 2" },
    customerName: "Ana",
    items: [{ id: "item-1", productName: "Hamburguesa", quantity: 1, lineTotalCents: 125000, fulfillment: "TABLE", notes: "Sin cebolla", options: [{ groupName: "Punto", valueName: "A punto" }] }],
    payments: [{ method: "CASH", status: "APPROVED", amountCents: 125000 }],
  }] }));
  await page.goto("/staff/orders");
  await expect(page.getByRole("heading", { name: "Pedidos del local" })).toBeVisible();
  await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();
  await expect(page.getByText("Punto: A punto")).toBeVisible();
  await expect(page.getByText("Nota: Sin cebolla")).toBeVisible();
  await expect(page.getByText("Efectivo en caja: Pago confirmado")).toBeVisible();
});

test("la navegación del staff sigue siendo usable a 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route("**/api/staff/summary", (route) => route.fulfill({ json: { pendingPayments: 0, activeCommands: 0, qrMode: "QR_OPEN", role: "ADMIN" } }));
  await page.goto("/staff");
  const navigation = page.getByRole("navigation", { name: "Navegación del equipo" });
  // Folded on a phone so the page content starts at the top.
  await expect(navigation).toBeHidden();
  await page.getByRole("button", { name: "Menú" }).click();
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Pedidos" })).toHaveAttribute("href", "/staff/orders");
  await expect(navigation.getByRole("group", { name: "Operación" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("Carta deja elegir varias fotos y las guarda en orden", async ({ page }) => {
  const product = { id: "burger", categoryId: "cat", category: { name: "Hamburguesas" }, name: "Hamburguesa", description: "", imageKey: null, imageUrl: null, images: [], priceCents: 950000, costCents: null, available: true, visible: true, featured: false, stockQuantity: null, station: "KITCHEN", fulfillment: "TABLE", sortOrder: 0, optionGroups: [] };
  const imageUpdates: unknown[] = [];
  let uploads = 0;
  await page.route("**/api/staff/catalog/categories", (route) => route.fulfill({ json: [{ id: "cat", name: "Hamburguesas", sortOrder: 0, visible: true }] }));
  await page.route("**/api/staff/catalog/products", (route) => route.fulfill({ json: [product] }));
  await page.route("**/api/staff/catalog/images", (route) => route.fulfill({ json: { key: `foto-${++uploads}.png` } }));
  await page.route("**/api/staff/catalog/products/burger", async (route) => {
    const body = route.request().postDataJSON() as { imageKeys?: string[] };
    if (body.imageKeys) imageUpdates.push(body);
    await route.fulfill({ json: product });
  });
  await page.goto("/staff/catalog");
  await page.getByRole("button", { name: "Editar" }).click();

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "frente.png", mimeType: "image/png", buffer: png },
    { name: "corte.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(page.getByText("frente.png (nueva)")).toBeVisible();
  await expect(page.getByText("corte.png (nueva)")).toBeVisible();

  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Producto guardado.")).toBeVisible();
  expect(uploads).toBe(2);
  expect(imageUpdates).toEqual([{ imageKeys: ["foto-1.png", "foto-2.png"] }]);
});
