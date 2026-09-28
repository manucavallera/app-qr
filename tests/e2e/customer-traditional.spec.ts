import { collectBrowserErrors, test, expect } from "./fixtures";

type PublicDetails = {
  business?: { locationUrl?: string | null; instagramUrl?: string | null; whatsappUrl?: string | null };
  service?: { hoursLabel?: string | null };
};

test("el cliente puede avanzar desde la carta hasta confirmar el pedido", async ({ page, qrToken }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "El flujo completo se ejecuta una vez en escritorio.");
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `e2e-order-${testInfo.project.name}-${Date.now()}` });
  const browserErrors = collectBrowserErrors(page);
  let publicDetails: PublicDetails = {};
  await page.route(`**/api/public/menu/${qrToken}`, async (route) => {
    const response = await route.fetch();
    const body = await response.json() as Record<string, unknown> & PublicDetails;
    publicDetails = { business: body.business, service: body.service };
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      json: {
        ...body,
        payment: {
          methods: ["MERCADO_PAGO", "CASH", "CARD_AT_COUNTER", "BANK_TRANSFER"],
          unavailable: [],
          transfer: { alias: "bar.prueba", cbuCvu: "0000000000000000000000", accountHolder: "Bar de prueba", instructions: "Enviá el comprobante por caja." },
        },
      },
    });
  });
  await page.goto(`/m/${encodeURIComponent(qrToken)}`);
  await expect(page.getByRole("heading", { name: /cómo te llamamos/i })).toBeVisible();
  await page.getByLabel("Tu nombre o apodo").fill("Prueba E2E");
  await page.getByRole("button", { name: "Ver la carta" }).click();
  await expect(page.getByRole("heading", { name: "Elegí algo rico." })).toBeVisible();
  const contactLinks = [
    { label: "Cómo llegar", href: publicDetails.business?.locationUrl },
    { label: "Instagram", href: publicDetails.business?.instagramUrl },
    { label: "WhatsApp", href: publicDetails.business?.whatsappUrl },
  ];
  for (const contact of contactLinks) {
    if (contact.href) await expect(page.getByRole("link", { name: contact.label })).toHaveAttribute("href", contact.href);
    else await expect(page.getByRole("link", { name: contact.label })).toHaveCount(0);
  }
  if (publicDetails.service?.hoursLabel) await expect(page.getByText(publicDetails.service.hoursLabel)).toBeVisible();
  else await expect(page.getByLabel(/Horario de atención/)).toHaveCount(0);
  await page.getByRole("button", { name: /Agregar Hamburguesa clásica/ }).click();
  await page.getByLabel("Jugosa").check();
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  await page.getByRole("link", { name: "Continuar con el pedido" }).click();
  await expect(page).toHaveURL(new RegExp(`/m/${qrToken}/checkout$`));
  await expect(page.getByRole("heading", { name: "Forma de pago" })).toBeVisible();
  await expect(page.getByText("Hamburguesa clásica")).toBeVisible();
  await expect(page.getByLabel("Mercado Pago")).toBeVisible();
  await expect(page.getByLabel("Transferencia bancaria")).toBeVisible();
  await page.getByLabel("Transferencia bancaria").check();
  await expect(page.getByText("bar.prueba")).toBeVisible();
  await expect(page.getByRole("button", { name: /copiar datos/i })).toBeVisible();
  await page.getByLabel("Mercado Pago").check();
  await page.route("**/api/public/orders", (route) => route.fulfill({ status: 201, json: { id: "order-mp" } }));
  await page.route("**/api/public/orders/order-mp/mercado-pago", (route) => route.fulfill({ json: { checkoutUrl: "http://fake-payments.local/checkout/order-mp" } }));
  await page.route("http://fake-payments.local/**", (route) => route.fulfill({ status: 200, body: "Pago de prueba" }));
  await page.getByRole("button", { name: "Ir a Mercado Pago" }).click();
  await expect(page).toHaveURL("http://fake-payments.local/checkout/order-mp");
  expect(browserErrors).toEqual([]);
});

test("la carta entra en una pantalla de 320px sin desborde horizontal", async ({ page, qrToken }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "La cobertura angosta se ejecuta en el proyecto móvil.");
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `e2e-narrow-${testInfo.project.name}-${Date.now()}` });
  const browserErrors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(`/m/${encodeURIComponent(qrToken)}`);
  await page.getByLabel("Tu nombre o apodo").fill("Pantalla angosta");
  await page.getByRole("button", { name: "Ver la carta" }).click();
  await expect(page.getByRole("heading", { name: "Elegí algo rico." })).toBeVisible();

  const firstProduct = page.locator(".menu-product").first();
  await expect(firstProduct.locator(".menu-product-image, .menu-product-image-placeholder")).toBeVisible();
  await expect(firstProduct.getByRole("heading")).toBeVisible();
  await expect(firstProduct.locator(".menu-product-price")).toBeVisible();
  await expect(firstProduct.getByRole("button", { name: /^Agregar / })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(browserErrors).toEqual([]);
});
