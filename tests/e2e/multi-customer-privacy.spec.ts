import { collectBrowserErrors, expect, test } from "./fixtures";

test("dos clientes de la misma mesa mantienen sesiones separadas", async ({ browser, baseURL, qrToken }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "La separación de sesiones se ejecuta una vez en escritorio.");
  const uniqueRun = Date.now();
  const firstContext = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": `e2e-privacy-ana-${uniqueRun}` } });
  const secondContext = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": `e2e-privacy-luis-${uniqueRun}` } });
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();
  const firstErrors = collectBrowserErrors(firstPage);
  const secondErrors = collectBrowserErrors(secondPage);

  try {
    await firstPage.goto(`/m/${encodeURIComponent(qrToken)}`);
    await firstPage.getByLabel("Tu nombre o apodo").fill("Ana E2E");
    await firstPage.getByRole("button", { name: "Ver la carta" }).click();
    await expect(firstPage.getByText("Hola, Ana E2E")).toBeVisible();

    await secondPage.goto(`/m/${encodeURIComponent(qrToken)}`);
    await secondPage.getByLabel("Tu nombre o apodo").fill("Luis E2E");
    await secondPage.getByRole("button", { name: "Ver la carta" }).click();
    await expect(secondPage.getByText("Hola, Luis E2E")).toBeVisible();
    await expect(secondPage.getByText("Hola, Ana E2E")).toHaveCount(0);
    expect([...firstErrors, ...secondErrors]).toEqual([]);
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
