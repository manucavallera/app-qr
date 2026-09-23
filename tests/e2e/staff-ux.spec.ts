import { test, expect } from "./fixtures";

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
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Pedidos" })).toHaveAttribute("href", "/staff/orders");
  await expect(navigation).toHaveCSS("overflow-x", "auto");
});
