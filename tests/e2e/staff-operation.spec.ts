import { test, expect, withStaffCookie } from "./fixtures";

test.beforeEach(async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Los flujos de staff se ejecutan una vez en escritorio.");
  await withStaffCookie(page, baseURL);
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
  // The same names are in the menu, so look at the task cards of the page itself.
  const tasks = page.getByRole("main");
  await expect(tasks.getByRole("link", { name: /pagos a confirmar/i })).toBeVisible();
  await expect(tasks.getByRole("link", { name: /nuevo pedido/i })).toBeVisible();
  // On a phone the menu, with the logout button, is folded behind "Menú".
  const menuToggle = page.getByRole("button", { name: "Menú" });
  if (await menuToggle.isVisible()) await menuToggle.click();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
});

test("el administrador ve el dinero a devolver y lo marca como devuelto", async ({ page }) => {
  let returned = false;
  const reconciliations: unknown[] = [];
  await page.route("**/api/staff/summary", (route) => route.fulfill({ json: { pendingPayments: 0, activeCommands: 0, qrMode: "QR_OPEN", role: "ADMIN", refundsDue: returned ? [] : [{ id: "pay-1", method: "MERCADO_PAGO", amountCents: 950000, orderNumber: 42 }] } }));
  await page.route("**/api/staff/payments/pay-1/reconciliation", async (route) => { reconciliations.push(route.request().postDataJSON()); returned = true; await route.fulfill({ json: { id: "pay-1", status: "REFUNDED", refundedCents: 950000 } }); });
  await page.goto("/staff");
  await expect(page.getByRole("alert").filter({ hasText: "Dinero para devolver" })).toContainText("Pedido #42");
  await page.getByRole("button", { name: "Ya lo devolví" }).click();
  await expect(page.getByText("Dinero para devolver")).toHaveCount(0);
  expect(reconciliations).toEqual([expect.objectContaining({ status: "REFUNDED", refundedCents: 950000 })]);
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
  await page.route("**/api/staff/settings", (route) => route.fulfill({ json: { role: "ADMIN", paymentSettings: { cashEnabled: true, cardAtCounterEnabled: true }, mercadoPagoConfigured: false } }));
  await page.route("**/api/staff/orders", async (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, json: { id: "counter-order", status: "CONFIRMED" } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/staff/counter");
  await expect(page.getByRole("heading", { name: /armá el pedido del mostrador/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /crear pedido/i })).toBeVisible();
});

test("Caja marca los productos agotados y avisa cuando queda poco stock", async ({ page }) => {
  await page.route("**/api/staff/catalog/products", (route) => route.fulfill({ json: [
    { id: "burger", name: "Hamburguesa clásica", priceCents: 950000, available: true, optionGroups: [], stockLeft: 0 },
    { id: "soda", name: "Limonada", priceCents: 300000, available: true, optionGroups: [], stockLeft: 2 },
    { id: "fries", name: "Papas", priceCents: 400000, available: true, optionGroups: [], stockLeft: null },
  ] }));
  await page.route("**/api/staff/catalog/categories", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/staff/tables", (route) => route.fulfill({ json: [{ id: "table", label: "Mesa 1", active: true }] }));
  await page.route("**/api/staff/settings", (route) => route.fulfill({ json: { role: "ADMIN", paymentSettings: { cashEnabled: true, cardAtCounterEnabled: true }, mercadoPagoConfigured: false } }));
  await page.route("**/api/staff/orders", (route) => route.fulfill({ json: [] }));
  await page.goto("/staff/counter");
  await expect(page.getByRole("button", { name: "Hamburguesa clásica, agotado" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Limonada/ })).toContainText("Quedan 2");
  await expect(page.getByRole("button", { name: /Papas/ })).toBeEnabled();
});

test("Caja muestra el QR de Mercado Pago y deja el pedido pendiente", async ({ page }) => {
  await page.route("**/api/staff/catalog/products", (route) => route.fulfill({ json: [{ id: "burger", name: "Hamburguesa clásica", priceCents: 950000, available: true, optionGroups: [] }] }));
  await page.route("**/api/staff/catalog/categories", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/staff/tables", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/staff/orders", async (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, json: { id: "counter-mp", status: "AWAITING_PAYMENT", payments: [{ method: "MERCADO_PAGO" }], paymentQrDataUrl: "data:image/png;base64,ZmFrZQ==" } });
    return route.fulfill({ json: [] });
  });
  await page.route("**/api/staff/settings", (route) => route.fulfill({ json: { role: "ADMIN", paymentSettings: { mercadoPagoEnabled: true, cashEnabled: true, cardAtCounterEnabled: true, bankTransferEnabled: false }, mercadoPagoConfigured: true } }));

  await page.goto("/staff/counter");
  await page.getByLabel("Nombre o referencia").fill("Cliente QR");
  await page.getByRole("radio", { name: "QR de Mercado Pago" }).check();
  await page.getByRole("button", { name: /Hamburguesa clásica/ }).click();
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await page.getByRole("button", { name: "Crear pedido" }).click();
  await expect(page.getByRole("img", { name: "QR para pagar el pedido" })).toBeVisible();
  await expect(page.getByText(/quedará pendiente hasta la confirmación/i)).toBeVisible();
});

test("Configuración y QR muestran sus acciones principales", async ({ page }) => {
  await page.route("**/api/staff/settings", (route) => route.fulfill({ json: { role: "ADMIN", settings: { name: "Bar de prueba", locationUrl: null, instagramUrl: null, whatsappUrl: null, manualMode: "SCHEDULED", timezone: "America/Argentina/Buenos_Aires" }, windows: [], paymentSettings: { mercadoPagoEnabled: false, cashEnabled: true, cardAtCounterEnabled: true, bankTransferEnabled: false, bankAlias: null, bankCbuCvu: null, bankAccountHolder: null, bankInstructions: null }, mercadoPagoConfigured: false } }));
  await page.goto("/staff/settings");
  await expect(page.getByRole("button", { name: /abrir pedidos qr/i })).toBeVisible();
  await expect(page.getByText(/transferencia bancaria/i)).toBeVisible();

  await page.route(/\/api\/staff\/tables(?:\?.*)?$/, (route) => route.fulfill({ json: [{ id: "table", label: "Mesa 1", active: true, qrConfigured: true, menuUrl: "http://localhost:3101/m/test" }] }));
  await page.goto("/staff/tables");
  await expect(page.getByRole("button", { name: /copiar enlace/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /imprimir/i })).toBeVisible();
});
