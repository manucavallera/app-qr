# Public Customer Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the browser runtime and deliver a truthful, configurable, mobile-first QR menu, checkout, and order-tracking experience matching the approved dark visual direction.

**Architecture:** Extend the existing singleton `BusinessSettings` record with optional public-profile fields, validate them through the current settings service, and expose a safe projection from the public menu endpoint. Keep order, payment, and session behavior unchanged; customer components consume the enriched menu contract and share one dark visual system. Browser tests exercise the real PostgreSQL-backed flow and fail on application console errors.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Prisma 7/PostgreSQL, Zod 4, Vitest, Testing Library, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-23-auditoria-integral-ux-y-aceptacion-design.md`

## Global Constraints

- Do not change order totals, payment approval rules, idempotency, role checks, or order-state transitions.
- Do not show invented business data; optional public links render only when configured.
- `unsafe-eval` is allowed only in development; production CSP must reject it.
- All customer copy remains Spanish and all primary actions remain keyboard accessible.
- Existing uncommitted changes outside files named by a task remain untouched.
- Read the relevant Next.js 16 guides in `node_modules/next/dist/docs/` before changing App Router, metadata, CSP, CSS, or image behavior.

## Review Focus

- Empty or malformed social links stay hidden publicly and are rejected by the admin API; Tasks 2–4 test this.
- A cross-midnight service window reports the correct hours after midnight; Task 4 tests Friday 18:00–01:00 at Saturday 00:30.
- Slow menu loading cannot submit a second customer session or strand the screen on `Entrando…`; Task 5 tests disabled/retry behavior.
- A missing product image, long name, unavailable product, and narrow 320 px viewport remain readable; Task 5 covers component and browser cases.
- Development CSP supports Next/React tooling while production omits `unsafe-eval`; Task 1 tests both policies and an HTTP response.

---

## File Map

### Browser baseline

- Modify: `src/lib/security/headers.ts` — environment-specific CSP.
- Modify: `src/lib/security/headers.test.ts` — development and production assertions.
- Create: `src/app/icon.svg` — Next.js favicon metadata file using the existing project mark.

### Public profile and settings

- Modify: `prisma/schema.prisma` — optional business profile fields.
- Create: `prisma/migrations/20260923_public_business_profile/migration.sql` — additive nullable columns.
- Modify: `prisma/seed.ts` — safe local business name; links remain null.
- Modify: `src/modules/operations/settings-service.ts` — `businessProfile` validation and role protection.
- Modify: `src/modules/operations/settings-service.test.ts` — pure validation/authorization cases.
- Modify: `src/app/api/staff/settings/route.ts` — read/write profile with audit metadata.
- Modify: `tests/integration/settings.test.ts` — persistence and permissions.
- Create: `src/components/staff/public-profile-fields.tsx` — focused form section.
- Create: `src/components/staff/public-profile-fields.test.tsx` — rendering/editing coverage.
- Modify: `src/app/staff/settings/page.tsx` — state and PATCH payload.

### Public menu contract and UI

- Create: `src/modules/operations/public-service-hours.ts` — pure public schedule formatter.
- Create: `src/modules/operations/public-service-hours.test.ts` — same-day/cross-midnight/closed cases.
- Modify: `src/app/api/public/menu/[qrToken]/route.ts` — safe `business` and `service` response.
- Modify: `tests/integration/settings.test.ts` — public projection excludes private configuration.
- Modify: `src/app/m/[qrToken]/menu-client.tsx` — explicit session/menu loading states and truthful data.
- Modify: `src/app/m/[qrToken]/menu-header.tsx` — optional configured links only.
- Modify: `src/app/m/[qrToken]/menu-header.test.tsx` — visible/hidden links.
- Modify: `src/modules/catalog/components/product-card.tsx` — compact row semantics.
- Create: `src/modules/catalog/components/product-card.test.tsx` — available/unavailable product actions.
- Modify: `src/modules/catalog/components/product-dialog.tsx` — customer theme hooks without behavior changes.
- Modify: `src/app/globals.css` — coherent customer design system.

### Checkout, tracking, and browser acceptance

- Create: `src/components/customer/customer-shell.tsx` — shared customer page frame.
- Create: `src/components/customer/customer-shell.test.tsx` — title/back/status semantics.
- Modify: `src/app/m/[qrToken]/checkout/page.tsx` — shared frame, load/error/retry states.
- Modify: `src/app/m/[qrToken]/orders/[id]/page.tsx` — shared frame and status hierarchy.
- Modify: `tests/e2e/customer-traditional.spec.ts` — real customer flow and stable selectors.
- Modify: `tests/e2e/fixtures.ts` — console error collection and real QR fixture.

---

### Task 1: Stabilize CSP and browser metadata

**Files:**
- Modify: `src/lib/security/headers.ts`
- Modify: `src/lib/security/headers.test.ts`
- Create: `src/app/icon.svg`

**Interfaces:**
- Produces: `securityHeaders(production?: boolean): Record<string, string>` where development CSP includes `unsafe-eval` and production CSP does not.
- Produces: `GET /favicon.ico` through Next.js file metadata without a 404.

- [ ] **Step 1: Write the failing CSP tests**

```ts
it("supports Next development styles and callstacks", () => {
  const policy = securityHeaders(false)["Content-Security-Policy"];
  expect(policy).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  expect(policy).toContain("style-src 'self' 'unsafe-inline'");
});

it("keeps eval disabled in production", () => {
  expect(securityHeaders(true)["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/security/headers.test.ts`  
Expected: FAIL because development lacks `unsafe-eval` and all environments lack `style-src`.

- [ ] **Step 3: Implement environment-specific directives**

```ts
const scriptSource = production
  ? "'self' 'unsafe-inline'"
  : "'self' 'unsafe-inline' 'unsafe-eval'";

const policy = `default-src 'self'; script-src ${scriptSource}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none';`;
```

Add `src/app/icon.svg` as a simple high-contrast project mark with a square `viewBox="0 0 64 64"`; do not embed scripts, remote fonts, or raster data.

- [ ] **Step 4: Verify unit and live HTTP behavior**

Run:

```bash
npm test -- src/lib/security/headers.test.ts
curl -I http://localhost:3000/staff/login
curl -I http://localhost:3000/favicon.ico
```

Expected: tests pass; the development CSP includes `unsafe-eval` and `style-src`; favicon returns 200.

- [ ] **Step 5: Commit**

```bash
git add src/lib/security/headers.ts src/lib/security/headers.test.ts src/app/icon.svg
git commit -m "fix(web): stabilize development browser policy"
```

### Task 2: Persist and validate the public business profile

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260923_public_business_profile/migration.sql`
- Modify: `prisma/seed.ts`
- Modify: `src/modules/operations/settings-service.ts`
- Modify: `src/modules/operations/settings-service.test.ts`

**Interfaces:**
- Produces `BusinessProfileInput`:

```ts
type BusinessProfileInput = {
  name: string;
  locationUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
};
```

- Extends `SettingsInput` with optional `businessProfile?: BusinessProfileInput`.
- Adds nullable `locationUrl`, `instagramUrl`, and `whatsappUrl` columns to `BusinessSettings`.

- [ ] **Step 1: Add failing pure validation tests**

```ts
it("rejects malformed public links", async () => {
  await expect(service.update({
    timezone: "America/Argentina/Buenos_Aires",
    windows: [],
    manualMode: "SCHEDULED",
    businessProfile: { name: "Bar", locationUrl: "maps", instagramUrl: null, whatsappUrl: null },
  }, "ADMIN")).rejects.toMatchObject({ name: "ZodError" });
});

it("prevents operators from editing the public profile", async () => {
  await expect(service.update(validInputWithProfile, "OPERATOR")).rejects.toMatchObject({ code: "FORBIDDEN" });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/modules/operations/settings-service.test.ts`  
Expected: FAIL because `businessProfile` is stripped or accepted without URL/role validation.

- [ ] **Step 3: Add the additive Prisma migration**

```sql
ALTER TABLE "BusinessSettings"
  ADD COLUMN "locationUrl" TEXT,
  ADD COLUMN "instagramUrl" TEXT,
  ADD COLUMN "whatsappUrl" TEXT;
```

Update the Prisma model with the same nullable fields. Keep the existing `name` column as the public display name. Seed links as `null`; never seed fake social accounts.

- [ ] **Step 4: Implement Zod validation and authorization**

```ts
const optionalPublicUrl = z.string().trim().max(500).url().nullable();
const businessProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  locationUrl: optionalPublicUrl,
  instagramUrl: optionalPublicUrl,
  whatsappUrl: optionalPublicUrl,
});
```

Reject an `OPERATOR` request when `businessProfile` or `paymentSettings` is present. Preserve the existing rule allowing an operator to apply `FORCE_PAUSED`.

- [ ] **Step 5: Regenerate Prisma, migrate, and verify**

Run:

```bash
npm run db:generate
npm test -- src/modules/operations/settings-service.test.ts
npm run typecheck
```

Expected: migration applies, malformed URLs and operator edits are rejected, and typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add prisma src/modules/operations/settings-service.ts src/modules/operations/settings-service.test.ts
git commit -m "feat(settings): add public business profile"
```

### Task 3: Expose public-profile editing in staff settings

**Files:**
- Create: `src/components/staff/public-profile-fields.tsx`
- Create: `src/components/staff/public-profile-fields.test.tsx`
- Modify: `src/app/api/staff/settings/route.ts`
- Modify: `src/app/staff/settings/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/integration/settings.test.ts`

**Interfaces:**
- Consumes `BusinessProfileInput` from Task 2.
- Produces `PublicProfileFields({ value, disabled, onChange })`.
- `PATCH /api/staff/settings` stores `businessProfile` in the same audited transaction as schedule and payment settings.

- [ ] **Step 1: Write the failing component test**

```tsx
render(<PublicProfileFields value={profile} disabled={false} onChange={onChange} />);
fireEvent.change(screen.getByLabelText("Nombre del local"), { target: { value: "Bar Nuevo" } });
expect(onChange).toHaveBeenCalledWith({ ...profile, name: "Bar Nuevo" });
expect(screen.getByLabelText("WhatsApp")).toHaveAttribute("type", "url");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/components/staff/public-profile-fields.test.tsx`  
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the focused form component**

Render four labeled fields: `Nombre del local`, `Ubicación en Google Maps`, `Instagram`, and `WhatsApp`. Convert an empty link field to `null` in `onChange`; keep the name non-empty through HTML `required` and server validation.

- [ ] **Step 4: Persist the fields in the API transaction**

```ts
create: {
  id: "default",
  name: input.businessProfile?.name ?? "Bar",
  timezone: input.timezone,
  manualMode: input.manualMode,
  locationUrl: input.businessProfile?.locationUrl,
  instagramUrl: input.businessProfile?.instagramUrl,
  whatsappUrl: input.businessProfile?.whatsappUrl,
},
update: {
  timezone: input.timezone,
  manualMode: input.manualMode,
  ...(input.businessProfile ? input.businessProfile : {}),
},
```

- [ ] **Step 5: Wire the settings page**

Load `settings.name` and the three URLs into local state, render `PublicProfileFields` for admins, and include `businessProfile` in the PATCH body only for admins. Operators see the values disabled and never send them.

- [ ] **Step 6: Add integration persistence and permission cases**

Extend `adminPatch` with a complete profile, PATCH it as admin, GET settings, and assert exact values. PATCH the same profile as operator and expect 403. Restore `name`, `locationUrl`, `instagramUrl`, and `whatsappUrl` in `afterAll`.

- [ ] **Step 7: Verify component, integration, lint, and typecheck**

Run:

```bash
npm test -- src/components/staff/public-profile-fields.test.tsx
npm run test:integration -- settings
npm run lint
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add src/components/staff/public-profile-fields.tsx src/components/staff/public-profile-fields.test.tsx src/app/api/staff/settings/route.ts src/app/staff/settings/page.tsx src/app/globals.css tests/integration/settings.test.ts
git commit -m "feat(staff): configure public business profile"
```

### Task 4: Publish truthful business and service information

**Files:**
- Create: `src/modules/operations/public-service-hours.ts`
- Create: `src/modules/operations/public-service-hours.test.ts`
- Modify: `src/app/api/public/menu/[qrToken]/route.ts`
- Modify: `tests/integration/settings.test.ts`

**Interfaces:**
- Produces:

```ts
type PublicBusiness = {
  name: string;
  locationUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
};

type PublicService = {
  mode: "QR_OPEN" | "COUNTER_ONLY" | "PAUSED";
  hoursLabel: string | null;
};

function publicServiceHours(
  now: Date,
  timezone: string,
  windows: readonly ServiceWindowInput[],
): string | null;
```

- `GET /api/public/menu/:qrToken` returns `business`, `service`, `categories`, `payment`, and `serverTime`; retain top-level `mode` temporarily for checkout compatibility until Task 6 removes that dependency.

- [ ] **Step 1: Write failing schedule tests**

```ts
expect(publicServiceHours(
  new Date("2026-09-19T03:30:00.000Z"),
  "America/Argentina/Buenos_Aires",
  [{ weekday: 5, opensAtMinute: 1080, closesAtMinute: 60, enabled: true }],
)).toBe("18:00hs a 01:00hs");

expect(publicServiceHours(now, timezone, [{ weekday: 1, opensAtMinute: 600, closesAtMinute: 1200, enabled: false }])).toBeNull();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/modules/operations/public-service-hours.test.ts`  
Expected: FAIL because the formatter does not exist.

- [ ] **Step 3: Implement the pure formatter**

Use Luxon with the stored timezone. At after-midnight times, inspect the previous weekday for a cross-midnight window before the current weekday. Format `0` as `00:00hs`, `60` as `01:00hs`, and `1440` as `00:00hs`.

- [ ] **Step 4: Extend the public route projection**

```ts
business: {
  name: settings?.name ?? "Bar",
  locationUrl: settings?.locationUrl ?? null,
  instagramUrl: settings?.instagramUrl ?? null,
  whatsappUrl: settings?.whatsappUrl ?? null,
},
service: {
  mode,
  hoursLabel: settings ? publicServiceHours(now, settings.timezone, windows) : null,
},
```

Do not expose timezone internals, audit metadata, payment secrets, or staff configuration.

- [ ] **Step 5: Add an integration assertion for the safe projection**

GET a real active-table menu after saving the profile. Assert public fields equal the saved values and stringify the response to assert it does not contain `SESSION_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, or staff email values.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- src/modules/operations/public-service-hours.test.ts
npm run test:integration -- settings
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/operations/public-service-hours.ts src/modules/operations/public-service-hours.test.ts src/app/api/public/menu/[qrToken]/route.ts tests/integration/settings.test.ts
git commit -m "feat(public): expose business and service details"
```

### Task 5: Rebuild the QR menu and loading flow

**Files:**
- Modify: `src/app/m/[qrToken]/menu-client.tsx`
- Modify: `src/app/m/[qrToken]/menu-header.tsx`
- Modify: `src/app/m/[qrToken]/menu-header.test.tsx`
- Modify: `src/modules/catalog/components/product-card.tsx`
- Create: `src/modules/catalog/components/product-card.test.tsx`
- Modify: `src/modules/catalog/components/product-dialog.tsx`
- Modify: `src/modules/catalog/components/product-dialog.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes `business` and `service` from Task 4.
- `MenuHeader` accepts `{ business: PublicBusiness; hoursLabel: string | null }` and renders only configured links.
- Keeps the accessible menu heading `La carta` and existing add-to-cart labels used by browser tests.

- [ ] **Step 1: Replace the header test with truthful-data cases**

```tsx
render(<MenuHeader business={{ name: "Bar Norte", locationUrl: null, instagramUrl: "https://instagram.com/bar", whatsappUrl: null }} hoursLabel={null} />);
expect(screen.getByText("Bar Norte")).toBeVisible();
expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/bar");
expect(screen.queryByRole("link", { name: "Cómo llegar" })).not.toBeInTheDocument();
expect(screen.queryByText(/hs a/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Add failing product-row tests**

Assert an available product exposes `Agregar Hamburguesa` and calls `onSelect`; an unavailable product exposes `Hamburguesa, agotado`, is disabled, and does not call `onSelect`.

- [ ] **Step 3: Run both focused tests and verify RED**

Run: `npm test -- src/app/m/\[qrToken\]/menu-header.test.tsx src/modules/catalog/components/product-card.test.tsx`  
Expected: FAIL because the header still requires hardcoded links and the product-row test file is new.

- [ ] **Step 4: Implement explicit loading state transitions**

Use `sessionStatus: "checking" | "needs-name" | "starting" | "ready" | "error"` instead of the current `sessionChecked/loading` combination. Disable the form while `starting`, set `ready` only after `loadMenu()` succeeds, and return to `needs-name` with a visible retry message on failure.

```ts
setSessionStatus("starting");
const response = await createSession();
await loadMenu();
setSessionStatus("ready");
```

- [ ] **Step 5: Implement the approved visual hierarchy**

Use a solid near-black page (`#070707`), max content width `640px`, 18–24 px horizontal padding, compact optional social navigation, truthful hours card, category headings, and flat product rows separated by `#2c2c2c`. Keep images square at 96–104 px, body copy at or above 13 px, touch targets at or above 40 px, and the sticky cart above the safe-area inset. Remove hardcoded URLs, hardcoded hours, decorative gradients, and the extra `Elegí tu pedido` heading.

- [ ] **Step 6: Keep product and cart behavior intact**

Retain option validation, notes, quantities, estimated totals, paused/counter-only messaging, and the link to checkout. Style the dialog and cart with the same customer tokens; do not alter cart persistence keys or item structure.

- [ ] **Step 7: Verify focused and existing customer tests**

Run:

```bash
npm test -- src/app/m/\[qrToken\]/menu-header.test.tsx src/modules/catalog/components/product-card.test.tsx src/modules/catalog/components/product-dialog.test.tsx src/modules/orders/cart-store.test.ts
npm run lint
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add 'src/app/m/[qrToken]' src/modules/catalog/components src/app/globals.css
git commit -m "feat(customer): rebuild the public QR menu"
```

### Task 6: Unify checkout and order tracking

**Files:**
- Create: `src/components/customer/customer-shell.tsx`
- Create: `src/components/customer/customer-shell.test.tsx`
- Modify: `src/app/m/[qrToken]/checkout/page.tsx`
- Modify: `src/app/m/[qrToken]/orders/[id]/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces `CustomerShell({ eyebrow, title, backHref?, children })` with the same dark customer surface used by the menu.
- Checkout consumes the Task 4 menu contract and exposes `loading`, `ready`, and `error` payment-method states.

- [ ] **Step 1: Write the failing shell test**

```tsx
render(<CustomerShell eyebrow="Paso 2 de 4" title="Confirmá tu pedido" backHref="/m/token"><p>Contenido</p></CustomerShell>);
expect(screen.getByRole("heading", { name: "Confirmá tu pedido" })).toBeVisible();
expect(screen.getByRole("link", { name: "Volver a la carta" })).toHaveAttribute("href", "/m/token");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/components/customer/customer-shell.test.tsx`  
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the shared shell**

Render semantic `<main>` and `<section>` elements with `customer-page` and `customer-card` classes. Use a real Next `Link` for `backHref`; keep action buttons supplied by page children.

- [ ] **Step 4: Add checkout load and retry states**

Do not default to cash/card before the API responds. Start with `paymentStatus = "loading"`; on failure show `No pudimos cargar los medios de pago` plus a `Reintentar` button that calls the same loader. Disable submit unless status is `ready`, cart is non-empty, and the selected method remains available.

- [ ] **Step 5: Move checkout and tracking to the shared visual system**

Preserve payment labels, transfer-copy behavior, Mercado Pago redirect, polling, SSE, fulfillment-specific ready messages, and retry payment action. Replace light `qr-welcome-shell` wrappers with `CustomerShell` and customer-specific CSS tokens.

- [ ] **Step 6: Verify components and type safety**

Run:

```bash
npm test -- src/components/customer/customer-shell.test.tsx src/modules/orders/cart-store.test.ts
npm run lint
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/components/customer 'src/app/m/[qrToken]/checkout' 'src/app/m/[qrToken]/orders' src/app/globals.css
git commit -m "feat(customer): unify checkout and tracking UI"
```

### Task 7: Lock the customer journey with browser acceptance

**Files:**
- Modify: `tests/e2e/customer-traditional.spec.ts`
- Modify: `tests/e2e/fixtures.ts`
- Modify: `playwright.config.ts`
- Modify: `docs/runbooks/local-acceptance.md`

**Interfaces:**
- Produces a real browser journey using the active dining-table token from PostgreSQL.
- Produces a console-error assertion that ignores only the React DevTools informational message and fails on CSP, hydration, uncaught, or network application errors.

- [ ] **Step 1: Add the browser console failure collector**

```ts
const browserErrors: string[] = [];
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("Download the React DevTools")) browserErrors.push(message.text());
});
page.on("pageerror", (error) => browserErrors.push(error.message));
```

Assert `browserErrors` equals `[]` at the end of each customer test.

- [ ] **Step 2: Update the real menu assertions**

Keep `La carta`, real seeded product names, `Agregar <producto>`, option selection, cart, checkout, transfer details, and Mercado Pago fake redirect. Add assertions that no unconfigured social link is present and the configured hours are visible only when the API returns them.

- [ ] **Step 3: Add narrow-mobile coverage**

At a 320×720 viewport, assert the first product image, name, price, and add button are visible without horizontal page overflow:

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
```

- [ ] **Step 4: Run focused E2E against Docker PostgreSQL**

Run:

```bash
npm run test:e2e -- tests/e2e/customer-traditional.spec.ts
```

Expected: customer session, menu, product options, cart, checkout methods, and fake Mercado Pago redirect pass with no console errors.

- [ ] **Step 5: Run the complete verification matrix**

Run:

```bash
npm test
npm run test:integration
npm run test:e2e
npm run typecheck
npm run lint
npm run build
git diff --check
```

Record exact totals and any non-blocking dependency warnings. Any failing browser test or comment-only browser case prevents completion.

- [ ] **Step 6: Update manual acceptance and commit**

Add fields for date, device, viewport, result, observation, and responsible person to `docs/runbooks/local-acceptance.md`, then commit:

```bash
git add tests/e2e playwright.config.ts docs/runbooks/local-acceptance.md
git commit -m "test(customer): cover the public ordering journey"
```

---

## Follow-up Plans

After this plan passes, create and execute two independent plans:

1. `staff-operations-ux-plan.md` — audit and improve Inicio, Caja, Comandas, mostrador, Pedidos, Carta, Mesas, Configuración, Usuarios, and Auditoría.
2. `full-e2e-and-local-acceptance-plan.md` — replace remaining comment-only browser cases and execute the complete device/on-site acceptance matrix.
