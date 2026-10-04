import { collectBrowserErrors, expect, test } from "./fixtures";

test("un pago digital pendiente puede reabrir Mercado Pago", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "El reintento digital se ejecuta una vez en escritorio.");
  const browserErrors = collectBrowserErrors(page);
  await page.route(/\/api\/public\/orders\/order-mp$/, (route) => route.fulfill({ json: {
    number: 42,
    status: "AWAITING_PAYMENT",
    totalCents: 950000,
    table: { label: "Mesa 1" },
    items: [{ productName: "Hamburguesa clásica", quantity: 1, lineTotalCents: 950000, fulfillment: "TABLE", notes: null, options: [] }],
    payments: [{ method: "MERCADO_PAGO", status: "UNPAID" }],
  } }));
  await page.route("**/api/public/orders/order-mp/events", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: "" }));
  await page.route("**/api/public/menu/test-token", (route) => route.fulfill({ json: { payment: { transfer: null } } }));
  await page.route("**/api/public/orders/order-mp/mercado-pago", (route) => route.fulfill({ json: { checkoutUrl: "http://fake-payments.local/retry/order-mp" } }));
  await page.route("http://fake-payments.local/**", (route) => route.fulfill({ status: 200, body: "Pago de prueba" }));

  await page.goto("/m/test-token/orders/order-mp");
  await expect(page.getByRole("heading", { name: "Pedido recibido" })).toBeVisible();
  await page.getByRole("button", { name: "Pagar con Mercado Pago" }).click();
  await expect(page).toHaveURL("http://fake-payments.local/retry/order-mp");
  expect(browserErrors).toEqual([]);
});
