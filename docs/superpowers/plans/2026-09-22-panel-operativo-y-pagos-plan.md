# Panel operativo y medios de pago Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the working QR order flow into a guided Spanish-language operation with a staff dashboard, complete payment choices, caja orders, editable settings, and usable QR controls.

**Architecture:** Preserve the existing modular Next.js application and business rules. Add a dedicated `PaymentSettings` record for enabled payment methods and bank-transfer instructions, expose small authenticated staff summary/settings capabilities, then layer a shared staff shell and task-oriented screens over the existing order/payment APIs. Customer payment and order status screens will use explicit method/status view models so technical enum values never leak into the UI.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Prisma 7/PostgreSQL, Zod 4, Vitest, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-22-panel-operativo-y-pagos-design.md`

## Global Constraints

- The client can use the browser through a permanent QR and does not create an account.
- All visible actions and states use Spanish copy.
- Cocina receives only orders with an approved payment.
- Mercado Pago approval comes only from a validated webhook; the browser return is informative.
- Cash, card at counter, and bank transfer remain pending until authorized by Caja.
- Bank transfer is manual in this version: show configured alias/CBU/CVU and confirm from Caja; do not upload or automatically validate receipts.
- QR tokens remain opaque, random, permanent per table, and regenerable.
- Prices, totals, payment status, and order transitions are validated on the server.
- Secrets for Mercado Pago remain server-only environment variables.
- Existing uncommitted user changes must remain untouched unless a task explicitly owns the same lines.

## Review Focus

- A customer selecting bank transfer must see complete instructions only when the method is configured, and the order must remain outside the kitchen queue until Caja confirms it. Test in Task 2 integration coverage.
- A repeated payment confirmation or repeated browser submission must not create a second approval or order transition. Test in Task 2 repository/API coverage.
- A QR opened after cutoff, while paused, or in counter-only mode must remain viewable but must not create a new order. Test in Task 3 and the existing E2E mode coverage.
- A staff user without the required role must not edit payment settings, users, schedules, or QR configuration. Test in Task 3 API coverage.
- A customer whose item is pickup must receive pickup instructions while a table item receives table-delivery instructions. Test in Task 5 customer E2E coverage.

## File Map

### Domain and persistence

- Modify: `prisma/schema.prisma` — add `BANK_TRANSFER` and the one-row `PaymentSettings` model.
- Create: `prisma/migrations/20260922_payment_settings/migration.sql` — add the enum value and payment settings table/constraints.
- Modify: `prisma/seed.ts` — seed safe local defaults without real banking data.
- Modify: `src/modules/orders/order-contracts.ts` — accept bank transfer and method-specific confirmation input.
- Modify: `src/modules/orders/order-repository.ts` — create, list, confirm, reject, and expose payment metadata for all manual methods.
- Modify: `src/modules/orders/order-view.ts` — return payment method/status and fulfillment summaries needed by UI.
- Create: `src/modules/payments/payment-methods.ts` — canonical method labels, availability rules, and Spanish status copy.
- Create: `src/modules/payments/payment-methods.test.ts` — pure tests for labels and method visibility.

### Staff APIs

- Create: `src/app/api/staff/summary/route.ts` — authenticated dashboard counts.
- Modify: `src/app/api/staff/settings/route.ts` — read/write operating mode, windows, enabled methods, and transfer instructions.
- Modify: `src/app/api/staff/payments/pending/route.ts` — include all manual payment methods and readable payment data.
- Modify: `src/app/api/staff/orders/[id]/confirm-traditional/route.ts` — confirm cash, card, or transfer with a single validated contract.
- Create: `src/app/api/staff/orders/[id]/reject-payment/route.ts` — reject an unpaid manual order with a reason.
- Modify: `src/app/api/staff/orders/route.ts` — support the counter-order UI contract and return enough detail for the order list.
- Create: `src/app/api/staff/tables/[id]/route.ts` — activate or deactivate a table for the QR controls.

### Staff UI

- Create: `src/components/staff/staff-shell.tsx` — shared navigation, current section, home link, logout, and responsive layout.
- Create: `src/components/staff/task-card.tsx` — reusable dashboard task cards with counts and primary actions.
- Create: `src/components/staff/status-copy.ts` — Spanish labels for order/payment/method values.
- Create: `tests/unit/staff-shell.test.tsx` — dashboard links, Spanish labels, and logout visibility.
- Create: `src/app/staff/page.tsx` — task-oriented staff home.
- Modify: `src/app/staff/payments/page.tsx` — method-specific confirmation/rejection actions.
- Modify: `src/app/staff/commands/page.tsx` — Spanish transitions, readable cards, station filters, fulfillment instructions.
- Modify: `src/app/staff/counter/page.tsx` — catalog-based counter order creation plus recent orders.
- Modify: `src/app/staff/settings/page.tsx` — editable modes, schedules, payment switches, and transfer instructions.
- Modify: `src/app/staff/tables/page.tsx` — test/copy/print/download/renew QR controls.
- Modify: `src/app/staff/catalog/page.tsx`, `src/app/staff/users/page.tsx`, `src/app/staff/audit/page.tsx` — shared shell and clearer navigation/messages.
- Modify: `src/app/staff/users/page.tsx` — expose the existing admin create/deactivate API through visible controls.
- Modify: `src/app/globals.css` — dashboard grid, nav, status, form, responsive, and disabled/loading styles.

### Customer UI and tests

- Modify: `src/app/m/[qrToken]/checkout/page.tsx` — payment cards, Mercado Pago action, manual-payment instructions, and real item names/options.
- Modify: `src/app/m/[qrToken]/orders/[id]/page.tsx` — payment/order stepper and table-versus-pickup messages.
- Modify: `src/app/m/[qrToken]/menu-client.tsx` — clear cart/checkout actions and counter-only/paused explanations.
- Modify: `tests/integration/order-flow.test.ts` — bank transfer and repeated-confirmation coverage.
- Create: `tests/integration/settings.test.ts` — payment settings, schedule, mode, and role coverage.
- Modify: `tests/e2e/customer-traditional.spec.ts` — complete guided customer/manual-payment flow.
- Create: `tests/e2e/staff-operation.spec.ts` — dashboard, payment methods, commands, counter order, settings, and QR actions.

## Task 1: Add payment settings and bank-transfer domain support

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260922_payment_settings/migration.sql`
- Modify: `prisma/seed.ts`
- Modify: `src/modules/orders/order-contracts.ts`
- Create: `src/modules/payments/payment-methods.ts`
- Create: `src/modules/payments/payment-methods.test.ts`

**Interfaces:**
- Produces `PaymentSettings` with one row keyed by `id = "default"` and fields `mercadoPagoEnabled`, `cashEnabled`, `cardAtCounterEnabled`, `bankTransferEnabled`, `bankAlias`, `bankCbuCvu`, `bankAccountHolder`, and `bankInstructions`.
- Produces `PaymentMethod = MERCADO_PAGO | CASH | CARD_AT_COUNTER | BANK_TRANSFER | OTHER`; `OTHER` remains readable for legacy records but is not accepted by new customer or counter inputs.
- Produces `paymentMethodLabel(method)` and `paymentStatusLabel(status)` for all visible UI consumers.

- [ ] **Step 1: Write failing pure tests** for method labels, disabled-method filtering, and the rule that bank transfer is unavailable when enabled without alias or CBU/CVU.
- [ ] **Step 2: Run the focused test** with `npm test -- src/modules/payments/payment-methods.test.ts`; verify it fails because the module and new enum are absent.
- [ ] **Step 3: Add the Prisma schema and migration** with a non-null settings row strategy compatible with existing databases; keep bank fields nullable and never store Mercado Pago secrets in PostgreSQL.
- [ ] **Step 4: Extend Zod contracts** so QR orders accept `BANK_TRANSFER`, counter orders remain limited to cash/card, and manual confirmation accepts cash/card/transfer plus the expected order version.
- [ ] **Step 5: Implement the pure payment-method helpers** and seed local defaults with cash, card, and transfer disabled until the operator configures them; keep Mercado Pago test configuration controlled by environment.
- [ ] **Step 6: Regenerate Prisma and run the focused tests** with `npm run db:generate` and `npm test -- src/modules/payments/payment-methods.test.ts`; expect all tests to pass.
- [ ] **Step 7: Commit** with `git add prisma src/modules/orders/order-contracts.ts src/modules/payments/payment-methods.ts && git commit -m "feat(payments): add bank transfer settings"`.

## Task 2: Complete server-side payment and staff summary behavior

**Files:**
- Modify: `src/modules/orders/order-repository.ts`
- Modify: `src/modules/orders/order-view.ts`
- Modify: `src/app/api/staff/settings/route.ts`
- Create: `src/app/api/staff/summary/route.ts`
- Modify: `src/app/api/staff/payments/pending/route.ts`
- Modify: `src/app/api/staff/orders/[id]/confirm-traditional/route.ts`
- Create: `src/app/api/staff/orders/[id]/reject-payment/route.ts`
- Modify: `src/app/api/staff/orders/route.ts`
- Modify: `tests/integration/order-flow.test.ts`
- Create or modify: `tests/integration/settings.test.ts`

**Interfaces:**
- `GET /api/staff/summary` returns `{ pendingPayments: number, activeCommands: number, qrMode: "QR_OPEN" | "COUNTER_ONLY" | "PAUSED" }` for `ADMIN` or `OPERATOR`.
- `GET/PATCH /api/staff/settings` returns and updates operating settings plus `paymentSettings`; only `ADMIN` changes schedules, payment configuration, and forced modes, while `OPERATOR` can apply only the allowed temporary pause.
- `POST /api/staff/orders/:id/confirm-traditional` accepts `{ method: "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER", expectedOrderVersion: number }` and is idempotent for an already-approved matching payment.
- `POST /api/staff/orders/:id/reject-payment` accepts `{ reason: string, expectedOrderVersion: number }` and cancels only an unpaid order still awaiting payment.

- [ ] **Step 1: Add failing integration cases** for creating a transfer order, hiding it from commands before confirmation, confirming it once, rejecting an unpaid order, summary counts, payment settings, and role restrictions.
- [ ] **Step 2: Run the focused integration tests** with `npm run test:integration -- order-flow settings`; verify failures identify the missing enum, settings persistence, and routes.
- [ ] **Step 3: Extend repository creation/list queries** to load `PaymentSettings`, reject disabled methods, require complete transfer instructions, and include method/status in pending payment results.
- [ ] **Step 4: Implement idempotent manual confirmation/rejection** inside transactions with optimistic version checks, audit entries, status events, and order notifications; retain `AWAITING_PAYMENT` until approval.
- [ ] **Step 5: Add the summary query and settings persistence** with explicit Zod validation for weekday windows, mode, payment switches, and bank instructions.
- [ ] **Step 6: Add/modify the authenticated routes** and map domain errors to clear API error codes without exposing secrets.
- [ ] **Step 7: Run the focused integration tests** and then `npm run typecheck`; expect transfer confirmation, rejection, counts, and permissions to pass.
- [ ] **Step 8: Commit** with `git add src/modules src/app/api tests/integration prisma && git commit -m "feat(api): complete manual payment operations"`.

The settings route payload produced by this task is:

```ts
type StaffSettingsPatch = {
  timezone: string;
  manualMode: "SCHEDULED" | "FORCE_QR_OPEN" | "FORCE_COUNTER_ONLY" | "FORCE_PAUSED";
  windows: Array<{ weekday: number; opensAtMinute: number; closesAtMinute: number; enabled: boolean }>;
  paymentSettings: {
    mercadoPagoEnabled: boolean;
    cashEnabled: boolean;
    cardAtCounterEnabled: boolean;
    bankTransferEnabled: boolean;
    bankAlias: string | null;
    bankCbuCvu: string | null;
    bankAccountHolder: string | null;
    bankInstructions: string | null;
  };
};
```

## Task 3: Build the shared staff shell and dashboard

**Files:**
- Create: `src/components/staff/staff-shell.tsx`
- Create: `src/components/staff/task-card.tsx`
- Create: `src/components/staff/status-copy.ts`
- Create: `src/app/staff/page.tsx`
- Modify: `src/app/staff/payments/page.tsx`
- Modify: `src/app/staff/commands/page.tsx`
- Modify: `src/app/staff/catalog/page.tsx`
- Modify: `src/app/staff/tables/page.tsx`
- Modify: `src/app/staff/users/page.tsx`
- Modify: `src/app/staff/audit/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- `StaffShell` accepts `{ title: string, section: StaffSection, children: ReactNode }` and renders links only for authorized/available sections.
- Dashboard consumes `GET /api/staff/summary` and navigates only through visible links.
- All staff screens use `paymentMethodLabel`, `paymentStatusLabel`, and order-state copy from the shared copy module.

- [ ] **Step 1: Add a component test or route-level smoke test** asserting that dashboard labels are Spanish, each task card links to its screen, and logout is visible.
- [ ] **Step 2: Run the focused UI test** with `npm test -- tests/unit/staff-shell.test.tsx`; verify it fails before the shell exists.
- [ ] **Step 3: Implement `StaffShell` and task cards** with responsive navigation, current-section highlighting, home link, and logout POST action.
- [ ] **Step 4: Implement `/staff`** with summary polling, empty states, and primary links for Caja, Comandas, Carta, Mesas, and Configuración.
- [ ] **Step 5: Wrap existing staff pages** with the shell and replace technical English statuses/buttons with Spanish action labels.
- [ ] **Step 6: Add CSS** for task cards, counts, state badges, mobile navigation, loading/disabled states, and readable touch targets.
- [ ] **Step 7: Run the UI test, lint, and typecheck**; expect the navigation and translations to pass.
- [ ] **Step 8: Commit** with `git add src/app/staff src/components/staff src/app/globals.css && git commit -m "feat(staff): add guided operations dashboard"`.

## Task 4: Finish Caja and editable configuration screens

**Files:**
- Modify: `src/app/staff/payments/page.tsx`
- Modify: `src/app/staff/counter/page.tsx`
- Modify: `src/app/staff/settings/page.tsx`
- Modify: `src/app/staff/tables/page.tsx`
- Modify: `src/app/staff/users/page.tsx`
- Modify: `src/app/api/staff/tables/[id]/route.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Payments screen calls the Task 2 confirmation/rejection endpoints and displays method-specific buttons.
- Counter screen posts `CreateCounterOrderInput` with `clientRequestId`, `expectedTotalCents`, `paymentMethod`, `nickname`, optional `tableId`, and item selections.
- Settings screen sends the exact `PATCH /api/staff/settings` payload including windows, `manualMode`, timezone, and `paymentSettings`.

- [ ] **Step 1: Create `tests/e2e/staff-operation.spec.ts` with named cases** for `confirms cash`, `confirms card`, `confirms transfer`, `creates a counter order`, `changes QR mode`, `opens/copies/downloads a QR`, and `deactivates a table`.
- [ ] **Step 2: Implement method-aware pending-payment cards** with amount, table, customer, time, payment details, confirm, reject, refresh, and clear feedback.
- [ ] **Step 3: Implement the counter order builder** using products/options from the catalog, table selection, nickname, quantity controls, total calculation, and successful confirmation.
- [ ] **Step 4: Replace read-only settings** with weekday schedule inputs, manual-mode buttons, payment switches, transfer fields, validation, save feedback, and permission-aware disabling.
- [ ] **Step 5: Add QR actions** for opening the test menu, copying the generated URL, downloading, printing, and renewing with confirmation.
- [ ] **Step 6: Run the focused E2E test** with `npm run test:e2e -- tests/e2e/staff-operation.spec.ts`; expect the new flows to pass against the local app and database.
- [ ] **Step 7: Commit** with `git add src/app/staff src/app/globals.css tests/e2e/staff-operation.spec.ts && git commit -m "feat(staff): add caja settings and QR actions"`.

## Task 5: Complete the customer payment and tracking experience

**Files:**
- Modify: `src/app/m/[qrToken]/checkout/page.tsx`
- Modify: `src/app/m/[qrToken]/orders/[id]/page.tsx`
- Modify: `src/app/m/[qrToken]/menu-client.tsx`
- Modify: `src/app/m/[qrToken]/payment/return/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/customer-traditional.spec.ts`

**Interfaces:**
- Checkout consumes menu payment availability and transfer instructions from the public menu response.
- Mercado Pago uses `POST /api/public/orders/:id/mercado-pago` and redirects only after the order exists.
- Manual methods keep the order URL as the source of truth and show payment instructions until staff approval.

- [ ] **Step 1: Add failing browser assertions** for real product names/options, four payment choices, transfer instructions/copy button, Mercado Pago redirect, and table-versus-pickup status text.
- [ ] **Step 2: Extend the public menu view** to expose only safe payment availability and transfer instructions; never expose credentials or webhook secrets.
- [ ] **Step 3: Rebuild checkout presentation** with a four-step indicator, payment cards, clear total, real item details, loading/error states, and method-specific primary buttons.
- [ ] **Step 4: Rebuild order tracking** with payment/order status steps, next-action copy, fulfillment-specific ready messages, and a visible return-to-menu action.
- [ ] **Step 5: Ensure paused/counter-only menus** retain the carta and show a direct message to Caja without showing an active checkout button.
- [ ] **Step 6: Run customer E2E tests** on desktop and mobile; expect manual and Mercado Pago test paths to pass.
- [ ] **Step 7: Commit** with `git add src/app/m tests/e2e/customer-traditional.spec.ts src/app/globals.css && git commit -m "feat(customer): guide payment and order tracking"`.

## Task 6: Full verification and delivery handoff

**Files:**
- Modify: `tests/e2e/customer-traditional.spec.ts` — update selectors and expected Spanish copy after the customer flow changes.
- Modify: `tests/e2e/staff-operation.spec.ts` — update selectors and expected task counts after the staff flow changes.
- Modify: `docs/propuesta-comercial-corregida.md` only if implementation decisions change the documented scope.

- [ ] **Step 1: Run unit tests** with `npm test` and verify all existing and new tests pass.
- [ ] **Step 2: Run integration tests** with `npm run test:integration` against the Docker PostgreSQL database and verify migrations are applied.
- [ ] **Step 3: Run browser tests** with `npm run test:e2e` in desktop and mobile projects.
- [ ] **Step 4: Run static checks** with `npm run typecheck`, `npm run lint`, `npm run build`, and `rtk git diff --check`.
- [ ] **Step 5: Manually verify the local acceptance path**: QR → nickname → product/options → Mercado Pago/manual method → Caja → Comanda → listo → delivered, plus QR mode changes and a counter order.
- [ ] **Step 6: Record any required environment values** for Mercado Pago and transfer details in `.env.example` without adding real credentials.
- [ ] **Step 7: Review `git status --short`** to ensure user-owned existing changes are preserved and only intended implementation files are committed.
