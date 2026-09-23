import { collectBrowserErrors, expect, test } from "./fixtures";

test("el cliente ve el corte de pedidos sin perder acceso a la carta", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "El corte funcional se ejecuta una vez en escritorio.");
  const browserErrors = collectBrowserErrors(page);
  await page.route("**/api/public/qr/cutoff-token/session", (route) => route.fulfill({ json: { nickname: "Ana" } }));
  await page.route("**/api/public/menu/cutoff-token", (route) => route.fulfill({ json: {
    table: { label: "Mesa 1" },
    mode: "COUNTER_ONLY",
    business: { name: "Bar", locationUrl: null, instagramUrl: null, whatsappUrl: null },
    service: { mode: "COUNTER_ONLY", hoursLabel: "18:00hs a 01:00hs" },
    categories: [],
    payment: { methods: ["CASH"], transfer: null },
    serverTime: new Date().toISOString(),
  } }));

  await page.goto("/m/cutoff-token");
  await expect(page.getByRole("heading", { name: "La carta" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("barra o caja");
  await expect(page.getByText("Todavía no hay productos publicados en la carta.")).toBeVisible();
  expect(browserErrors).toEqual([]);
});
