import { collectBrowserErrors, expect, test } from "./fixtures";

const tab = (overrides: Record<string, unknown> = {}) => ({
  tableLabel: "Mesa 3",
  tabNumber: 7,
  billRequestedAt: null,
  mine: { totalCents: 1500, orders: [{ number: 12, totalCents: 1500, items: [{ productName: "Hamburguesa clásica", quantity: 1, lineTotalCents: 1500 }] }] },
  tableTotalCents: 4000,
  canPayOnline: true,
  ...overrides,
});

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "La cuenta de mesa se prueba una vez en escritorio.");
});

test("el cliente paga su parte de la cuenta con Mercado Pago", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  let payBody: unknown;
  await page.route("**/api/public/tab", (route) => route.fulfill({ json: tab() }));
  await page.route("**/api/public/tab/pay", (route) => {
    payBody = route.request().postDataJSON();
    return route.fulfill({ json: { checkoutUrl: "http://fake-payments.local/tab/mine" } });
  });
  await page.route("http://fake-payments.local/**", (route) => route.fulfill({ status: 200, body: "Pago de prueba" }));

  await page.goto("/m/test-token/account");
  await expect(page.getByRole("heading", { name: "Mi cuenta" })).toBeVisible();
  // El pago online es la acción principal; pedir la cuenta al mozo queda como alternativa.
  await expect(page.getByRole("button", { name: "Pedir la cuenta" })).toHaveClass(/cm-btn-quiet/);
  await page.getByRole("button", { name: /Pagar mi parte con Mercado Pago/ }).click();
  await expect(page).toHaveURL("http://fake-payments.local/tab/mine");
  expect(payBody).toEqual({ scope: "mine" });
  expect(browserErrors).toEqual([]);
});

test("el cliente paga toda la mesa con Mercado Pago", async ({ page }) => {
  let payBody: unknown;
  await page.route("**/api/public/tab", (route) => route.fulfill({ json: tab() }));
  await page.route("**/api/public/tab/pay", (route) => {
    payBody = route.request().postDataJSON();
    return route.fulfill({ json: { checkoutUrl: "http://fake-payments.local/tab/table" } });
  });
  await page.route("http://fake-payments.local/**", (route) => route.fulfill({ status: 200, body: "Pago de prueba" }));

  await page.goto("/m/test-token/account");
  await page.getByRole("button", { name: /Pagar toda la mesa/ }).click();
  await expect(page).toHaveURL("http://fake-payments.local/tab/table");
  expect(payBody).toEqual({ scope: "table" });
});

test("sin pago online la cuenta solo ofrece pedir la cuenta al mozo", async ({ page }) => {
  await page.route("**/api/public/tab", (route) => route.fulfill({ json: tab({ canPayOnline: false }) }));

  await page.goto("/m/test-token/account");
  await expect(page.getByRole("button", { name: "Pedir la cuenta" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pedir la cuenta" })).not.toHaveClass(/cm-btn-quiet/);
  await expect(page.getByRole("button", { name: /Pagar mi parte/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Pagar toda la mesa/ })).toHaveCount(0);
});

test("si no se puede abrir el pago online muestra un aviso y deja pagar en caja", async ({ page }) => {
  await page.route("**/api/public/tab", (route) => route.fulfill({ json: tab() }));
  await page.route("**/api/public/tab/pay", (route) => route.fulfill({ status: 409, json: { error: "TAB_ONLINE_PAYMENT_UNAVAILABLE" } }));

  await page.goto("/m/test-token/account");
  await page.getByRole("button", { name: /Pagar mi parte/ }).click();
  await expect(page.getByText(/pagá en caja o con el mozo/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Pagar mi parte/ })).toBeEnabled();
});

test("al volver de Mercado Pago avisa que recibió el pago", async ({ page }) => {
  await page.route("**/api/public/tab", (route) => route.fulfill({ json: tab({ mine: { totalCents: 0, orders: [] }, tableTotalCents: 0 }) }));

  await page.goto("/m/test-token/account?pago=ok");
  await expect(page.getByRole("status").filter({ hasText: "Recibimos tu pago" })).toBeVisible();
});
