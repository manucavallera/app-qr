import { test, expect } from "./fixtures";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Los flujos de staff se ejecutan una vez en escritorio.");
});

const paymentOrder = (id: string, number: number, method: "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER") => ({
  id,
  number,
  customerName: "Cliente prueba",
  totalCents: 950000,
  version: 1,
  table: { label: "Mesa 1" },
  createdAt: new Date().toISOString(),
  payments: [{ method, status: "UNPAID" }],
});

test("el personal ve las tareas principales en el inicio", async ({ page }) => {
  await page.route("**/api/staff/summary", (route) => route.fulfill({ json: { pendingPayments: 2, activeCommands: 3, qrMode: "QR_OPEN", role: "ADMIN" } }));
  await page.goto("/staff");
  await expect(page.getByRole("heading", { name: "¿Qué necesitás hacer?" })).toBeVisible();
  await expect(page.getByRole("link", { name: /pagos pendientes/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /nuevo pedido en caja/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
});

test("Caja puede confirmar efectivo, tarjeta y transferencia", async ({ page }) => {
  const confirmedMethods: string[] = [];
  await page.route(/\/api\/staff\/payments\/pending(?:\?.*)?$/, (route) => route.fulfill({ json: [paymentOrder("cash", 1, "CASH"), paymentOrder("card", 2, "CARD_AT_COUNTER"), paymentOrder("transfer", 3, "BANK_TRANSFER")] }));
  await page.route(/\/api\/staff\/orders\/[^/]+\/confirm-traditional$/, async (route) => {
    confirmedMethods.push((JSON.parse(route.request().postData() ?? "{}").method as string) ?? "");
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/staff/payments");
  await page.getByRole("button", { name: "Confirmar efectivo" }).click();
  await page.getByRole("button", { name: "Confirmar tarjeta" }).click();
  await page.getByRole("button", { name: "Confirmar transferencia" }).click();
  expect(confirmedMethods).toEqual(["CASH", "CARD_AT_COUNTER", "BANK_TRANSFER"]);
});

test("el personal puede crear un pedido en caja", async ({ page }) => {
  await page.route("**/api/staff/catalog/products", (route) => route.fulfill({ json: [{ id: "burger", name: "Hamburguesa clásica", priceCents: 950000, available: true, optionGroups: [] }] }));
  await page.route("**/api/staff/catalog/categories", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/staff/tables", (route) => route.fulfill({ json: [{ id: "table", label: "Mesa 1", active: true }] }));
  await page.route("**/api/staff/orders", async (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, json: { id: "counter-order", status: "CONFIRMED" } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/staff/counter");
  await expect(page.getByRole("heading", { name: /nuevo pedido en caja/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /crear pedido/i })).toBeVisible();
});

test("Configuración y QR muestran sus acciones principales", async ({ page }) => {
  await page.route("**/api/staff/settings", (route) => route.fulfill({ json: { settings: { name: "Bar de prueba", locationUrl: null, instagramUrl: null, whatsappUrl: null, manualMode: "SCHEDULED", timezone: "America/Argentina/Buenos_Aires" }, windows: [], paymentSettings: { mercadoPagoEnabled: false, cashEnabled: true, cardAtCounterEnabled: true, bankTransferEnabled: false, bankAlias: null, bankCbuCvu: null, bankAccountHolder: null, bankInstructions: null }, mercadoPagoConfigured: false } }));
  await page.goto("/staff/settings");
  await expect(page.getByRole("button", { name: /abrir pedidos qr/i })).toBeVisible();
  await expect(page.getByText(/transferencia bancaria/i)).toBeVisible();

  await page.route(/\/api\/staff\/tables(?:\?.*)?$/, (route) => route.fulfill({ json: [{ id: "table", label: "Mesa 1", active: true, qrConfigured: true, menuUrl: "http://localhost:3101/m/test" }] }));
  await page.goto("/staff/tables");
  await expect(page.getByRole("button", { name: /copiar enlace/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /imprimir/i })).toBeVisible();
});
