import { test, expect } from "./fixtures";
test("el cliente puede avanzar desde la carta hasta confirmar el pedido", async ({ page, qrToken }) => {
  await page.route(`**/api/public/menu/${qrToken}`, async (route) => {
    const response = await route.fetch();
    const body = await response.json() as Record<string, unknown>;
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      json: {
        ...body,
        payment: {
          methods: ["MERCADO_PAGO", "CASH", "CARD_AT_COUNTER", "BANK_TRANSFER"],
          transfer: { alias: "bar.prueba", cbuCvu: "0000000000000000000000", accountHolder: "Bar de prueba", instructions: "Enviá el comprobante por caja." },
        },
      },
    });
  });
  await page.goto(`/m/${encodeURIComponent(qrToken)}`);
  await expect(page.getByRole("heading", { name: /cómo te llamamos/i })).toBeVisible();
  await page.getByLabel("Tu nombre o apodo").fill("Prueba E2E");
  await page.getByRole("button", { name: "Ver la carta" }).click();
  await expect(page.getByRole("heading", { name: "La carta" })).toBeVisible();
  await page.getByRole("button", { name: /Agregar Hamburguesa clásica/ }).click();
  await page.getByLabel("Jugosa").check();
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  await page.getByRole("link", { name: "Continuar con el pedido" }).click();
  await expect(page).toHaveURL(new RegExp(`/m/${qrToken}/checkout$`));
  await expect(page.getByRole("heading", { name: "Confirmá tu pedido" })).toBeVisible();
  await expect(page.getByText("Hamburguesa clásica")).toBeVisible();
  await expect(page.getByText("Mercado Pago")).toBeVisible();
  await expect(page.getByText("Transferencia bancaria")).toBeVisible();
  await page.getByLabel("Transferencia bancaria").check();
  await expect(page.getByText("bar.prueba")).toBeVisible();
  await expect(page.getByRole("button", { name: /copiar datos/i })).toBeVisible();
  await page.getByLabel("Mercado Pago").check();
  await page.route("**/api/public/orders", (route) => route.fulfill({ status: 201, json: { id: "order-mp" } }));
  await page.route("**/api/public/orders/order-mp/mercado-pago", (route) => route.fulfill({ json: { checkoutUrl: "http://fake-payments.local/checkout/order-mp" } }));
  await page.route("http://fake-payments.local/**", (route) => route.fulfill({ status: 200, body: "Pago de prueba" }));
  await page.getByRole("button", { name: "Ir a Mercado Pago" }).click();
  await expect(page).toHaveURL("http://fake-payments.local/checkout/order-mp");
});
