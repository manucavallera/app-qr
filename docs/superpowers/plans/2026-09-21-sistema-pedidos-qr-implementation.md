# Sistema de Autogestión y Pedidos QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Construir y desplegar la primera versión productiva del sistema de pedidos individuales por QR, pagos, comandas y administración para un bar.

**Architecture:** Aplicación web modular en Next.js desplegada como un único servicio Node.js, con PostgreSQL como fuente de verdad y módulos separados por función de negocio. Las interfaces del cliente, operación y administración comparten reglas de dominio y API; PostgreSQL LISTEN/NOTIFY alimenta Server-Sent Events y cada cliente vuelve a consultar el estado completo después de una reconexión.

**Tech Stack:** Node.js 24.11 o posterior de la línea 24 LTS; Next.js 16 con React 19 y TypeScript; PostgreSQL 18; Prisma ORM 7.10; Zod; Tailwind CSS; SDK oficial de Mercado Pago; Vitest; Testing Library; Playwright; Docker.

**Spec:** docs/superpowers/specs/2026-09-21-sistema-pedidos-qr-design.md

## Global Constraints

- El alcance inicial es una sola empresa y un solo local.
- La aplicación es web responsive y no requiere una aplicación nativa.
- El cliente no crea una cuenta; usa una sesión anónima y un nombre o apodo.
- Ningún pedido entra a preparación sin pago digital confirmado o confirmación del personal.
- Los estados del pedido y del pago permanecen separados.
- El QR permite pedidos solamente dentro de la ventana semanal configurada; fuera de ella muestra la carta y deriva a barra o caja.
- La zona horaria del negocio es America/Argentina/Buenos_Aires.
- Los importes se guardan como centavos enteros en ARS; el navegador nunca decide el precio final.
- Mercado Pago usa Orders API, clave de idempotencia, webhook firmado y verificación del estado remoto.
- La cola inicial es GENERAL, pero productos e ítems conservan estación y modalidad de entrega.
- Node.js 20 instalado actualmente está fuera de soporte; la ejecución comienza después de instalar Node.js 24.11 o posterior.
- Prisma ORM 7.10 se mantiene fijado mientras Prisma ORM 8 continúe sin versión general estable.
- El repositorio guarda package-lock.json y todas las instalaciones usan npm ci después del primer lock.
- Docker Desktop debe tener habilitada la integración con esta distribución WSL antes de ejecutar las tareas de PostgreSQL y empaquetado.
- Los nombres internos KITCHEN y BAR se muestran en español como Cocina y Barra; GENERAL se muestra como General.

## Review Focus

1. Ventanas que cruzan medianoche: viernes 18:00–01:00 acepta pedidos el sábado a las 00:30 y los bloquea a la 01:00; Task 3 fija este comportamiento.
2. Webhook o solicitud repetidos: una repetición no duplica pago, pedido, evento ni comanda; Tasks 7 y 8 lo prueban.
3. Dos clientes de una mesa: cada token accede solamente a sus propios pedidos; Tasks 6 y 7 lo prueban.
4. Carta desactualizada: producto agotado, opción inválida o precio cambiado obliga a revisar el carrito; Tasks 3 y 7 lo prueban.
5. Desconexión y concurrencia: la reconexión recupera el estado real y dos operadores no pueden aplicar transiciones incompatibles; Tasks 9 y 10 lo prueban.

---

## File Structure

La implementación crea esta estructura. Cada módulo contiene reglas, acceso a datos y contratos de su función; las rutas HTTP solamente validan, autentican y delegan.

    package.json                         Dependencias y comandos reproducibles
    package-lock.json                    Versiones exactas instaladas
    .nvmrc                               Node.js 24
    .env.example                         Variables locales sin secretos productivos
    Dockerfile                           Imagen de producción standalone
    compose.yaml                         PostgreSQL local y aplicación opcional
    next.config.ts                       Salida standalone y cabeceras
    prisma.config.ts                     Configuración de Prisma 7
    prisma/schema.prisma                 Modelo transaccional completo
    prisma/seed.ts                       Comercio, horarios, mesas, carta y administrador local
    src/app/                             Páginas y Route Handlers de Next.js
    src/app/m/[qrToken]/                 Experiencia móvil del cliente
    src/app/staff/                       Caja, comandas y administración
    src/modules/auth/                    Sesiones y roles del personal
    src/modules/catalog/                 Carta, opciones, precios e imágenes
    src/modules/tables/                  Mesas, QR y sesiones anónimas
    src/modules/operations/              Ventanas horarias y modo efectivo
    src/modules/orders/                  Cotización, pedidos, estados y comandas
    src/modules/payments/                Pagos tradicionales y Mercado Pago
    src/modules/realtime/                Publicación PostgreSQL y SSE
    src/modules/audit/                   Auditoría de acciones internas
    src/lib/                             Entorno, base de datos, HTTP y seguridad común
    src/generated/prisma/                Cliente generado; no se edita manualmente
    tests/integration/                   Pruebas con PostgreSQL
    tests/e2e/                           Recorridos completos con Playwright
    docs/runbooks/                       Despliegue, respaldo, incidentes y apertura del local

## Delivery Sequence

- **Milestone 1 — Base operable:** Tasks 1–4. La aplicación inicia, persiste el modelo, calcula reglas y autentica personal.
- **Milestone 2 — Pedido sin pago digital:** Tasks 5–7. Carta, QR, cliente, pedidos y cobro tradicional funcionan de extremo a extremo.
- **Milestone 3 — Operación completa:** Tasks 8–10. Mercado Pago, comandas y tiempo real funcionan con reconexión.
- **Milestone 4 — Producción:** Tasks 11–13. Administración final, seguridad, despliegue y aceptación en el local.

### Task 1: Scaffold reproducible and health slice

**Files:**
- Create: package.json
- Create: package-lock.json
- Create: .nvmrc
- Create: .gitignore
- Create: .env.example
- Create: tsconfig.json
- Create: next.config.ts
- Create: eslint.config.mjs
- Create: vitest.config.ts
- Create: vitest.setup.ts
- Create: src/app/layout.tsx
- Create: src/app/page.tsx
- Create: src/app/globals.css
- Create: src/app/api/health/route.ts
- Test: src/app/api/health/route.test.ts

**Interfaces:**
- Consumes: Node.js 24.11+, npm 10+, approved design specification.
- Produces: GET /api/health returning HealthResponse; npm scripts dev, build, lint, typecheck, test, test:integration and test:e2e.

- [ ] **Step 1: Verify the runtime fails on the current unsupported Node version**

Run:

    node -e "const major=Number(process.versions.node.split('.')[0]); if (major < 24) process.exit(1)"

Expected before upgrading: exit 1 because the current runtime is Node.js 20.

- [ ] **Step 2: Install or select Node.js 24 LTS and initialize Git**

Run:

    nvm install 24
    nvm use 24
    git init

Expected: node --version reports v24.11.0 or a newer v24 release, and git status shows an empty repository plus the existing docs directory.

- [ ] **Step 3: Create package.json with fixed major versions and scripts**

Write:

    {
      "name": "app-qr",
      "version": "0.1.0",
      "private": true,
      "engines": { "node": ">=24.11 <25" },
      "scripts": {
        "dev": "next dev",
        "build": "next build",
        "start": "next start",
        "lint": "eslint .",
        "typecheck": "tsc --noEmit",
        "test": "vitest run",
        "test:watch": "vitest",
        "test:integration": "tsx scripts/run-integration-tests.ts",
        "test:e2e": "playwright test",
        "db:generate": "prisma generate",
        "db:migrate": "prisma migrate dev",
        "db:deploy": "prisma migrate deploy",
        "db:seed": "prisma db seed"
      },
      "dependencies": {
        "@aws-sdk/client-s3": "^3.0.0",
        "@prisma/adapter-pg": "7.10.0",
        "@prisma/client": "7.10.0",
        "argon2": "^0.44.0",
        "luxon": "^3.0.0",
        "mercadopago": "^2.0.0",
        "next": "^16.0.0",
        "pg": "^8.0.0",
        "pino": "^9.0.0",
        "qrcode": "^1.5.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "zod": "^4.0.0"
      },
      "devDependencies": {
        "@playwright/test": "^1.0.0",
        "@testing-library/jest-dom": "^6.0.0",
        "@testing-library/react": "^16.0.0",
        "@types/luxon": "^3.0.0",
        "@types/node": "^24.0.0",
        "@types/pg": "^8.0.0",
        "@types/qrcode": "^1.5.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "eslint": "^9.0.0",
        "eslint-config-next": "^16.0.0",
        "jsdom": "^27.0.0",
        "prisma": "7.10.0",
        "tailwindcss": "^4.0.0",
        "tsx": "^4.0.0",
        "typescript": "^5.9.0",
        "vite": "^7.0.0",
        "vitest": "^3.0.0"
      }
    }

Run npm install and commit the generated package-lock.json. If npm resolves a peer conflict, change only the conflicting direct dependency to the compatible stable release and record that exact release in package.json before continuing. Ignore .env, var/uploads and src/generated/prisma in .gitignore.

- [ ] **Step 4: Write the failing health route test**

    import { describe, expect, it } from "vitest";
    import { GET } from "./route";

    describe("GET /api/health", () => {
      it("returns an explicit healthy response", async () => {
        const response = await GET();
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
          status: "ok",
          service: "app-qr"
        });
      });
    });

Run:

    npm test -- src/app/api/health/route.test.ts

Expected: FAIL because route.ts does not exist.

- [ ] **Step 5: Implement the minimal health route and app shell**

    export type HealthResponse = {
      status: "ok";
      service: "app-qr";
    };

    export async function GET(): Promise<Response> {
      const body: HealthResponse = { status: "ok", service: "app-qr" };
      return Response.json(body);
    }

Create the Spanish root layout with html lang="es-AR", responsive viewport metadata and a home page linking to /staff/login. Configure next.config.ts with output: "standalone".

- [ ] **Step 6: Add environment validation**

Create src/lib/env.ts with a Zod server schema for DATABASE_URL, APP_URL, SESSION_SECRET, MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET, S3 endpoint variables and PAYMENT_PROVIDER. Use separate publicEnv for variables beginning with NEXT_PUBLIC_. Add a unit test proving that missing DATABASE_URL returns a readable validation error without logging secret values.

- [ ] **Step 7: Verify and commit**

Run:

    npm test
    npm run lint
    npm run typecheck
    npm run build

Expected: all commands pass.

Commit:

    git add package.json package-lock.json .nvmrc .gitignore .env.example tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts src
    git commit -m "chore: scaffold QR ordering app"

### Task 2: PostgreSQL model, migrations, and seed

**Files:**
- Create: compose.yaml
- Create: docker/postgres/init.sql
- Create: prisma.config.ts
- Create: prisma/schema.prisma
- Create: prisma/seed.ts
- Create: src/lib/db.ts
- Create: vitest.integration.config.ts
- Create: scripts/run-integration-tests.ts
- Test: tests/integration/schema.test.ts

**Interfaces:**
- Consumes: DATABASE_URL and Prisma ORM 7.10.
- Produces: prisma singleton; all persisted enums and models used by later tasks.

- [ ] **Step 1: Add the local PostgreSQL service**

Use postgres:18-alpine with database appqr, user appqr, password appqr_dev, port 5432 and a named volume. Mount docker/postgres/init.sql into /docker-entrypoint-initdb.d/01-test-database.sql with this content:

    CREATE DATABASE appqr_test;

Put these local values in .env.example:

    DATABASE_URL=postgresql://appqr:appqr_dev@localhost:5432/appqr
    TEST_DATABASE_URL=postgresql://appqr:appqr_dev@localhost:5432/appqr_test
    APP_URL=http://localhost:3000
    SESSION_SECRET=local-development-secret-with-32-bytes
    PAYMENT_PROVIDER=fake
    MERCADOPAGO_ACCESS_TOKEN=test-token-unused-by-fake-provider
    MERCADOPAGO_WEBHOOK_SECRET=test-webhook-secret-unused-by-fake-provider
    IMAGE_STORAGE_DRIVER=local
    UPLOAD_DIR=var/uploads
    SEED_ADMIN_EMAIL=admin@local.test
    SEED_ADMIN_PASSWORD=local-admin-password-change-before-production

Copy .env.example to .env, then run:

    docker compose up -d db

Expected: PostgreSQL reports healthy and both appqr and appqr_test exist.

- [ ] **Step 2: Define the complete Prisma schema**

prisma.config.ts:

    import "dotenv/config";
    import { defineConfig, env } from "prisma/config";

    export default defineConfig({
      schema: "prisma/schema.prisma",
      migrations: {
        path: "prisma/migrations",
        seed: "tsx prisma/seed.ts"
      },
      datasource: {
        url: env("DATABASE_URL")
      }
    });

The schema must contain these enums exactly:

    enum StaffRole { ADMIN OPERATOR }
    enum ManualMode { SCHEDULED FORCE_QR_OPEN FORCE_COUNTER_ONLY FORCE_PAUSED }
    enum OrderOrigin { QR COUNTER }
    enum OrderStatus { DRAFT AWAITING_PAYMENT CONFIRMED PREPARING READY DELIVERED CANCELLED }
    enum OrderItemStatus { QUEUED PREPARING READY DELIVERED }
    enum PaymentMethod { MERCADO_PAGO CASH CARD_AT_COUNTER OTHER }
    enum PaymentStatus { UNPAID PENDING APPROVED REJECTED REFUNDED PARTIALLY_REFUNDED }
    enum PreparationStation { GENERAL KITCHEN BAR }
    enum FulfillmentType { TABLE PICKUP }

Define these models and constraints:

    BusinessSettings(
      id String @id @default("default"),
      name String,
      timezone String @default("America/Argentina/Buenos_Aires"),
      manualMode ManualMode @default(SCHEDULED),
      updatedAt DateTime @updatedAt
    )

    ServiceWindow(
      id String @id @default(uuid()),
      weekday Int @unique,
      opensAtMinute Int,
      closesAtMinute Int,
      enabled Boolean @default(true)
    )

    StaffUser(
      id String @id @default(uuid()),
      email String @unique,
      displayName String,
      passwordHash String,
      role StaffRole,
      active Boolean @default(true),
      createdAt DateTime @default(now()),
      updatedAt DateTime @updatedAt
    )

    StaffSession(
      id String @id @default(uuid()),
      tokenHash String @unique,
      userId String,
      expiresAt DateTime,
      createdAt DateTime @default(now()),
      user StaffUser @relation(fields: [userId], references: [id], onDelete: Cascade)
    )

    DiningTable(
      id String @id @default(uuid()),
      label String @unique,
      qrToken String @unique,
      active Boolean @default(true),
      createdAt DateTime @default(now()),
      updatedAt DateTime @updatedAt
    )

    CustomerSession(
      id String @id @default(uuid()),
      tableId String,
      nickname String,
      tokenHash String @unique,
      expiresAt DateTime,
      closedAt DateTime?,
      createdAt DateTime @default(now()),
      table DiningTable @relation(fields: [tableId], references: [id])
    )

    Category(
      id String @id @default(uuid()),
      name String,
      sortOrder Int @default(0),
      visible Boolean @default(true),
      createdAt DateTime @default(now()),
      updatedAt DateTime @updatedAt
    )

    Product(
      id String @id @default(uuid()),
      categoryId String,
      name String,
      description String,
      imageKey String?,
      priceCents Int,
      available Boolean @default(true),
      visible Boolean @default(true),
      station PreparationStation @default(GENERAL),
      fulfillment FulfillmentType @default(TABLE),
      sortOrder Int @default(0),
      createdAt DateTime @default(now()),
      updatedAt DateTime @updatedAt,
      category Category @relation(fields: [categoryId], references: [id]),
      optionGroups OptionGroup[]
    )

    OptionGroup(
      id String @id @default(uuid()),
      productId String,
      name String,
      required Boolean @default(false),
      minSelections Int @default(0),
      maxSelections Int @default(1),
      sortOrder Int @default(0),
      product Product @relation(fields: [productId], references: [id], onDelete: Cascade),
      values OptionValue[]
    )

    OptionValue(
      id String @id @default(uuid()),
      groupId String,
      name String,
      priceDeltaCents Int @default(0),
      available Boolean @default(true),
      sortOrder Int @default(0),
      group OptionGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
    )

    Order(
      id String @id @default(uuid()),
      number Int @unique @default(autoincrement()),
      clientRequestId String @unique,
      tableId String?,
      customerSessionId String?,
      createdByStaffId String?,
      origin OrderOrigin,
      status OrderStatus @default(AWAITING_PAYMENT),
      totalCents Int,
      version Int @default(1),
      cancellationReason String?,
      createdAt DateTime @default(now()),
      updatedAt DateTime @updatedAt,
      table DiningTable? @relation(fields: [tableId], references: [id]),
      customerSession CustomerSession? @relation(fields: [customerSessionId], references: [id]),
      createdByStaff StaffUser? @relation(fields: [createdByStaffId], references: [id]),
      items OrderItem[],
      payments PaymentAttempt[],
      statusEvents OrderStatusEvent[]
    )

    OrderItem(
      id String @id @default(uuid()),
      orderId String,
      productId String?,
      productName String,
      quantity Int,
      unitBaseCents Int,
      optionsTotalCents Int,
      lineTotalCents Int,
      station PreparationStation,
      fulfillment FulfillmentType,
      status OrderItemStatus @default(QUEUED),
      notes String?,
      order Order @relation(fields: [orderId], references: [id], onDelete: Cascade),
      options OrderItemOption[]
    )

    OrderItemOption(
      id String @id @default(uuid()),
      orderItemId String,
      optionValueId String?,
      groupName String,
      valueName String,
      priceDeltaCents Int,
      orderItem OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
    )

    PaymentAttempt(
      id String @id @default(uuid()),
      orderId String,
      method PaymentMethod,
      status PaymentStatus,
      amountCents Int,
      refundedCents Int @default(0),
      idempotencyKey String @unique,
      providerOrderId String? @unique,
      providerPayload Json?,
      confirmedByStaffId String?,
      createdAt DateTime @default(now()),
      updatedAt DateTime @updatedAt,
      order Order @relation(fields: [orderId], references: [id], onDelete: Cascade),
      confirmedByStaff StaffUser? @relation(fields: [confirmedByStaffId], references: [id])
    )

    OrderStatusEvent(
      id String @id @default(uuid()),
      orderId String,
      fromStatus OrderStatus?,
      toStatus OrderStatus,
      actorStaffId String?,
      reason String?,
      createdAt DateTime @default(now()),
      order Order @relation(fields: [orderId], references: [id], onDelete: Cascade),
      actorStaff StaffUser? @relation(fields: [actorStaffId], references: [id])
    )

    AuditEvent(
      id String @id @default(uuid()),
      actorStaffId String?,
      action String,
      entityType String,
      entityId String,
      metadata Json,
      createdAt DateTime @default(now())
    )

    RateLimitBucket(
      key String @id,
      count Int,
      resetsAt DateTime,
      updatedAt DateTime @updatedAt
    )

Use explicit relation names OrderCreator, PaymentConfirmer and StatusActor wherever StaffUser has more than one relationship to the order domain. Add these inverse collections:

    StaffUser.sessions
    StaffUser.createdOrders @relation("OrderCreator")
    StaffUser.confirmedPayments @relation("PaymentConfirmer")
    StaffUser.statusEvents @relation("StatusActor")
    StaffUser.auditEvents
    DiningTable.customerSessions
    DiningTable.orders
    CustomerSession.orders
    Category.products
    Product.orderItems
    OptionValue.orderItemOptions

Order.createdByStaff uses OrderCreator; PaymentAttempt.confirmedByStaff uses PaymentConfirmer; OrderStatusEvent.actorStaff uses StatusActor; AuditEvent.actorStaff references StaffUser. Product and OptionValue snapshot references use onDelete: SetNull so catalog edits never erase historical lines.

Add indexes for Order(status, createdAt), Order(customerSessionId), Order(tableId), Product(categoryId, sortOrder), CustomerSession(tableId, expiresAt), PaymentAttempt(orderId, status) and OrderStatusEvent(orderId, createdAt).

- [ ] **Step 3: Write the failing schema integration test**

The test creates one table, two customer sessions on that table, one order per session and asserts that both orders retain distinct customerSessionId values. It also attempts to insert a second weekday ServiceWindow and expects the unique constraint to reject it.

Run:

    npm run test:integration -- tests/integration/schema.test.ts

Expected: FAIL because the migration and Prisma client do not exist.

- [ ] **Step 4: Add the integration-test runner**

scripts/run-integration-tests.ts must:

1. Read TEST_DATABASE_URL and fail clearly if it is missing.
2. Run npx prisma migrate deploy with DATABASE_URL set to TEST_DATABASE_URL.
3. Run npx vitest run --config vitest.integration.config.ts plus any file arguments passed to the script.
4. Forward the first nonzero exit code.

vitest.integration.config.ts sets DATABASE_URL from TEST_DATABASE_URL before importing application modules and runs database tests serially.

- [ ] **Step 5: Generate and apply the initial migration**

Run:

    npm run db:generate
    npx prisma migrate dev --name initial_schema

Expected: prisma validate passes, the migration is created, and all tables exist.

- [ ] **Step 6: Implement the Prisma singleton and deterministic seed**

Create src/lib/db.ts with one pg Pool, PrismaPg adapter and PrismaClient cached in globalThis during development. Seed:

- BusinessSettings named Bar de hamburguesas.
- Seven disabled ServiceWindow records; installation explicitly enables the real days and hours.
- Categories Hamburguesas and Bebidas.
- One configurable burger with a required cooking-point group.
- One beverage assigned to BAR and PICKUP.
- Tables Mesa 1 through Mesa 10 with crypto.randomBytes(24).toString("base64url") QR tokens.
- One admin whose email and password come from SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD; hash with Argon2id and abort if either is missing.

- [ ] **Step 7: Run integration verification and commit**

Run:

    npm run db:seed
    npm run test:integration -- tests/integration/schema.test.ts
    npm run typecheck

Expected: PASS.

Commit:

    git add compose.yaml docker/postgres/init.sql prisma.config.ts prisma src/lib/db.ts vitest.integration.config.ts scripts/run-integration-tests.ts tests/integration/schema.test.ts
    git commit -m "feat: add transactional data model"

### Task 3: Pure business rules

**Files:**
- Create: src/modules/operations/service-mode.ts
- Create: src/modules/orders/order-state.ts
- Create: src/modules/orders/quote.ts
- Create: src/modules/orders/errors.ts
- Test: src/modules/operations/service-mode.test.ts
- Test: src/modules/orders/order-state.test.ts
- Test: src/modules/orders/quote.test.ts

**Interfaces:**
- Consumes: ServiceWindowInput, ManualMode, catalog products and selected option IDs.
- Produces: resolveServiceMode(), assertOrderTransition(), calculateQuote().

- [ ] **Step 1: Write failing schedule tests**

    it("keeps a cross-midnight Friday window open on Saturday at 00:30", () => {
      const windows = [
        { weekday: 5, opensAtMinute: 1080, closesAtMinute: 60, enabled: true }
      ];
      const now = new Date("2026-09-19T03:30:00.000Z");
      expect(resolveServiceMode(now, "America/Argentina/Buenos_Aires", windows, "SCHEDULED"))
        .toBe("QR_OPEN");
    });

    it("closes the same window at its exact cutoff", () => {
      const windows = [
        { weekday: 5, opensAtMinute: 1080, closesAtMinute: 60, enabled: true }
      ];
      const now = new Date("2026-09-19T04:00:00.000Z");
      expect(resolveServiceMode(now, "America/Argentina/Buenos_Aires", windows, "SCHEDULED"))
        .toBe("COUNTER_ONLY");
    });

Also test FORCE_QR_OPEN, FORCE_COUNTER_ONLY and FORCE_PAUSED.

- [ ] **Step 2: Implement resolveServiceMode**

Use Luxon to convert the server instant to the configured zone. Check both the current weekday's opening and the previous weekday's cross-midnight tail. Return PAUSED or the forced mode before evaluating the schedule.

Signature:

    export type ServiceMode = "QR_OPEN" | "COUNTER_ONLY" | "PAUSED";

    export function resolveServiceMode(
      now: Date,
      timezone: string,
      windows: ServiceWindowInput[],
      manualMode: ManualMode
    ): ServiceMode;

- [ ] **Step 3: Write failing state transition tests**

Test:

- AWAITING_PAYMENT to CONFIRMED succeeds.
- CONFIRMED to PREPARING succeeds.
- READY to PREPARING fails with INVALID_ORDER_TRANSITION.
- OPERATOR cannot cancel PREPARING.
- ADMIN can cancel PREPARING with a nonempty reason.
- READY and DELIVERED cannot become CANCELLED.

- [ ] **Step 4: Implement the transition matrix**

    const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
      DRAFT: ["AWAITING_PAYMENT", "CANCELLED"],
      AWAITING_PAYMENT: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["PREPARING", "CANCELLED"],
      PREPARING: ["READY", "CANCELLED"],
      READY: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: []
    };

assertOrderTransition receives current status, target status, role and reason and throws a DomainError with a stable code.

- [ ] **Step 5: Write failing quote tests**

Cover:

- Required group omitted.
- More values than maxSelections.
- Unavailable product.
- Unavailable option value.
- Quantity zero and quantity above 20.
- Expected total differs from server total.
- Base ARS 10,000 plus two ARS 500 extras at quantity two equals 2,200,000 cents.

- [ ] **Step 6: Implement calculateQuote**

Signature:

    export type QuoteRequest = {
      expectedTotalCents: number;
      items: Array<{
        productId: string;
        quantity: number;
        optionValueIds: string[];
        notes?: string;
      }>;
    };

    export type OrderQuote = {
      totalCents: number;
      items: QuotedOrderItem[];
    };

The function accepts catalog rows loaded by the repository, validates every selection and returns immutable snapshots for OrderItem and OrderItemOption. It never uses a price sent by the client except expectedTotalCents for change detection.

- [ ] **Step 7: Verify and commit**

Run:

    npm test -- src/modules/operations src/modules/orders

Expected: PASS.

Commit:

    git add src/modules/operations src/modules/orders
    git commit -m "feat: define ordering business rules"

### Task 4: Staff authentication and authorization

**Files:**
- Create: src/modules/auth/auth-service.ts
- Create: src/modules/auth/session-repository.ts
- Create: src/modules/auth/require-staff.ts
- Create: src/modules/auth/password.ts
- Create: src/lib/security/token.ts
- Create: src/app/api/staff/auth/login/route.ts
- Create: src/app/api/staff/auth/logout/route.ts
- Create: src/app/staff/login/page.tsx
- Test: src/modules/auth/auth-service.test.ts
- Test: tests/integration/auth.test.ts

**Interfaces:**
- Consumes: StaffUser and StaffSession.
- Produces: login(email, password), logout(token), requireStaff(request, roles), staff_session HttpOnly cookie.

- [ ] **Step 1: Write failing authentication tests**

Test that a correct password creates a session, a wrong password returns INVALID_CREDENTIALS, an inactive user is rejected, a stored token is a SHA-256 hash rather than the cookie value, and an expired session is rejected.

- [ ] **Step 2: Implement password and token primitives**

Use argon2id with library defaults plus explicit type argon2.argon2id. Generate 32 random bytes for session tokens, encode as base64url, hash with SHA-256 for storage and compare hashes with timingSafeEqual where direct comparison is needed.

- [ ] **Step 3: Implement the auth service and cookie**

Cookie:

    {
      name: "staff_session",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12
    }

requireStaff returns:

    export type StaffPrincipal = {
      userId: string;
      displayName: string;
      role: "ADMIN" | "OPERATOR";
    };

It returns 401 without a valid session and 403 when the role is valid but not permitted.

- [ ] **Step 4: Add login/logout routes and page**

POST /api/staff/auth/login accepts:

    { "email": "admin@local.test", "password": "a nonempty string" }

Return only id, displayName and role. Never return passwordHash, token hash or raw token in JSON.

- [ ] **Step 5: Add database-backed login rate limiting**

Create consumeRateLimit(key, limit, windowSeconds) using an atomic PostgreSQL upsert on RateLimitBucket. Apply 5 attempts per 15 minutes per normalized email plus hashed IP. A successful login clears that bucket.

- [ ] **Step 6: Verify and commit**

Run:

    npm test -- src/modules/auth
    npm run test:integration -- tests/integration/auth.test.ts

Expected: PASS.

Commit:

    git add src/modules/auth src/lib/security src/app/api/staff/auth src/app/staff/login tests/integration/auth.test.ts
    git commit -m "feat: secure staff access"

### Task 5: Catalog, tables, images, and QR administration

**Files:**
- Create: src/modules/catalog/catalog-schemas.ts
- Create: src/modules/catalog/catalog-service.ts
- Create: src/modules/catalog/catalog-repository.ts
- Create: src/modules/catalog/storage.ts
- Create: src/modules/tables/table-service.ts
- Create: src/app/api/staff/catalog/categories/route.ts
- Create: src/app/api/staff/catalog/products/route.ts
- Create: src/app/api/staff/catalog/products/[id]/route.ts
- Create: src/app/api/staff/catalog/images/route.ts
- Create: src/app/uploads/[key]/route.ts
- Create: src/app/api/staff/tables/route.ts
- Create: src/app/api/staff/tables/[id]/qr/route.ts
- Create: src/app/staff/catalog/page.tsx
- Create: src/app/staff/tables/page.tsx
- Test: src/modules/catalog/catalog-service.test.ts
- Test: tests/integration/catalog-admin.test.ts

**Interfaces:**
- Consumes: ADMIN or OPERATOR principal, Prisma catalog models and S3 configuration.
- Produces: CatalogProductInput, catalog CRUD, setAvailability(), regenerateQr(), SVG download.

- [ ] **Step 1: Write failing catalog validation tests**

Use this concrete input contract:

    const productInput = z.object({
      categoryId: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(600),
      priceCents: z.number().int().min(0).max(2_000_000_000),
      available: z.boolean(),
      visible: z.boolean(),
      station: z.enum(["GENERAL", "KITCHEN", "BAR"]),
      fulfillment: z.enum(["TABLE", "PICKUP"]),
      sortOrder: z.number().int().min(0),
      optionGroups: z.array(z.object({
        name: z.string().trim().min(1).max(80),
        required: z.boolean(),
        minSelections: z.number().int().min(0),
        maxSelections: z.number().int().min(1),
        values: z.array(z.object({
          name: z.string().trim().min(1).max(80),
          priceDeltaCents: z.number().int().min(0),
          available: z.boolean()
        })).min(1)
      }))
    });

Test minSelections <= maxSelections and required groups having minSelections >= 1.

- [ ] **Step 2: Implement transactional catalog writes**

Updating a product replaces its option groups and values inside one Prisma transaction while preserving existing OrderItem snapshots. setAvailability performs a focused update and writes AuditEvent.

- [ ] **Step 3: Implement image storage**

Define:

    export interface ImageStorage {
      put(input: { key: string; bytes: Uint8Array; contentType: "image/jpeg" | "image/png" | "image/webp" }): Promise<void>;
      publicUrl(key: string): string;
      delete(key: string): Promise<void>;
    }

Production uses S3Client. Development uses LocalImageStorage rooted at var/uploads and serves files through /uploads/:key. Select the adapter with IMAGE_STORAGE_DRIVER=local or s3. Accept JPEG, PNG and WebP only, maximum 3 MB, verify file signatures and generate random object keys. Do not accept SVG uploads and reject path separators in keys.

- [ ] **Step 4: Implement table and QR administration**

regenerateQr replaces qrToken with 24 random bytes encoded as base64url and records an audit event. GET /api/staff/tables/:id/qr returns image/svg+xml generated from APP_URL + "/m/" + qrToken. The previous URL stops resolving immediately.

- [ ] **Step 5: Build catalog and table pages**

The catalog page supports category ordering, product editing, nested option groups, image upload and an immediate available/agotado switch. The table page lists labels, QR status, regenerate action with confirmation and printable SVG.

- [ ] **Step 6: Verify and commit**

Run:

    npm test -- src/modules/catalog
    npm run test:integration -- tests/integration/catalog-admin.test.ts
    npm run typecheck

Expected: PASS.

Commit:

    git add src/modules/catalog src/modules/tables src/app/api/staff/catalog src/app/api/staff/tables src/app/staff/catalog src/app/staff/tables tests/integration/catalog-admin.test.ts
    git commit -m "feat: manage menu tables and QR codes"

### Task 6: Public QR session and menu experience

**Files:**
- Create: src/modules/tables/customer-session-service.ts
- Create: src/modules/tables/customer-session-auth.ts
- Create: src/app/api/public/qr/[qrToken]/session/route.ts
- Create: src/app/api/public/menu/[qrToken]/route.ts
- Create: src/app/m/[qrToken]/page.tsx
- Create: src/app/m/[qrToken]/menu-client.tsx
- Create: src/modules/catalog/components/product-card.tsx
- Create: src/modules/catalog/components/product-dialog.tsx
- Create: src/modules/orders/cart-store.ts
- Test: tests/integration/customer-session.test.ts
- Test: src/modules/orders/cart-store.test.ts
- Test: src/modules/catalog/components/product-dialog.test.tsx

**Interfaces:**
- Consumes: active DiningTable, visible catalog, resolveServiceMode().
- Produces: customer_session cookie scoped to /m and public menu response containing effective mode.

- [ ] **Step 1: Write failing privacy and expiry tests**

Create two sessions on Mesa 1 with nicknames Ana and Luis. Assert that each receives a different raw token, only token hashes are persisted, tokens expire after four hours, and closing Ana's session does not close Luis's session.

- [ ] **Step 2: Implement session creation**

POST /api/public/qr/:qrToken/session accepts:

    { "nickname": "Ana" }

Normalize whitespace, require 1–40 characters, reject inactive or unknown QR with 404 and create a four-hour CustomerSession. Set customer_session as HttpOnly, SameSite=Lax, Secure in production and Path=/. Rate limit to 10 new sessions per QR and IP per hour.

- [ ] **Step 3: Implement the public menu response**

GET /api/public/menu/:qrToken returns:

    {
      "table": { "label": "Mesa 1" },
      "mode": "QR_OPEN",
      "categories": [],
      "serverTime": "2026-09-21T20:00:00.000Z"
    }

Return only visible categories, visible products and available option values. Keep unavailable visible products in the response with available=false so the UI can show Agotado.

- [ ] **Step 4: Build the mobile menu and cart**

The route first asks for nickname if there is no valid session. The menu supports category navigation, product dialog, required options, quantities, notes and a sticky cart total. cart-store persists only product IDs, selected option IDs, notes and the latest displayed total in localStorage under a key containing the QR token.

In COUNTER_ONLY or PAUSED, show the reason and hide checkout while leaving menu browsing available.

- [ ] **Step 5: Test two clients on one table**

The integration test creates two sessions with independent cookies, adds distinct local cart data in component tests and proves the menu response contains no customer or order data.

- [ ] **Step 6: Verify and commit**

Run:

    npm test -- src/modules/orders/cart-store.test.ts src/modules/catalog/components/product-dialog.test.tsx
    npm run test:integration -- tests/integration/customer-session.test.ts

Expected: PASS.

Commit:

    git add src/modules/tables src/modules/catalog/components src/modules/orders/cart-store.ts src/app/api/public src/app/m tests/integration/customer-session.test.ts
    git commit -m "feat: add QR menu and customer sessions"

### Task 7: Order creation, traditional payment, and counter orders

**Files:**
- Create: src/modules/orders/order-service.ts
- Create: src/modules/orders/order-repository.ts
- Create: src/modules/orders/order-contracts.ts
- Create: src/modules/payments/traditional-payment-service.ts
- Create: src/app/api/public/orders/route.ts
- Create: src/app/api/public/orders/[id]/route.ts
- Create: src/app/api/staff/payments/pending/route.ts
- Create: src/app/api/staff/orders/[id]/confirm-traditional/route.ts
- Create: src/app/api/staff/orders/route.ts
- Create: src/app/m/[qrToken]/checkout/page.tsx
- Create: src/app/m/[qrToken]/orders/[id]/page.tsx
- Create: src/app/staff/payments/page.tsx
- Create: src/app/staff/counter/page.tsx
- Test: src/modules/orders/order-service.test.ts
- Test: tests/integration/order-flow.test.ts

**Interfaces:**
- Consumes: calculateQuote(), customer session, effective service mode, catalog snapshot.
- Produces: createQrOrder(), createCounterOrder(), confirmTraditionalPayment(), GET own order.

- [ ] **Step 1: Write failing order creation tests**

Cover:

- QR order in QR_OPEN creates one AWAITING_PAYMENT order and one UNPAID traditional PaymentAttempt.
- The same clientRequestId returns the original order.
- QR order in COUNTER_ONLY returns QR_ORDERING_CLOSED.
- Customer A cannot GET Customer B's order from the same table.
- Product becoming unavailable after entering the cart returns PRODUCT_UNAVAILABLE.
- A changed expected total returns PRICE_CHANGED with the fresh quote.
- Quantity and option rules are enforced again on the server.

- [ ] **Step 2: Implement the public order contract**

    const createQrOrderInput = z.object({
      clientRequestId: z.string().uuid(),
      expectedTotalCents: z.number().int().nonnegative(),
      paymentMethod: z.enum(["MERCADO_PAGO", "CASH", "CARD_AT_COUNTER"]),
      items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
        optionValueIds: z.array(z.string().uuid()),
        notes: z.string().trim().max(160).optional()
      })).min(1).max(30)
    });

createQrOrder loads the customer session from the cookie, resolves mode using the same transaction timestamp, calculates the quote and persists snapshots. A unique clientRequestId makes retries return the same order.

Apply a database-backed limit of 20 order-creation attempts per customer session and IP per hour. Idempotent retries with an existing clientRequestId return the existing result without consuming another slot.

- [ ] **Step 3: Implement traditional payment confirmation**

POST /api/staff/orders/:id/confirm-traditional accepts:

    { "method": "CASH", "expectedOrderVersion": 1 }

Inside one transaction:

1. Lock or conditionally update the order where version matches.
2. Confirm it remains AWAITING_PAYMENT.
3. Mark the PaymentAttempt APPROVED with confirmedByStaffId.
4. Move the order to CONFIRMED and increment version.
5. Insert OrderStatusEvent and AuditEvent.
6. Publish the order event inside the same PostgreSQL transaction.

A second submission returns the already-confirmed order without a second event.

- [ ] **Step 4: Implement staff counter orders**

POST /api/staff/orders accepts the same item selection plus tableId optional, nickname required, payment method and clientRequestId. It works in every service mode. The selected traditional payment is confirmed in the creation transaction, so the counter order enters CONFIRMED.

- [ ] **Step 5: Build checkout, own-order, pending-payment and counter pages**

Checkout shows the fresh server quote before the final action. Traditional payment shows Esperando confirmación de caja. The own-order route verifies the session owner on every request. Staff pending payments show age, table, nickname, total and confirm/reject actions.

- [ ] **Step 6: Verify and commit**

Run:

    npm test -- src/modules/orders/order-service.test.ts
    npm run test:integration -- tests/integration/order-flow.test.ts

Expected: PASS, including idempotency and cross-session privacy.

Commit:

    git add src/modules/orders src/modules/payments/traditional-payment-service.ts src/app/api/public/orders src/app/api/staff/payments src/app/api/staff/orders src/app/m src/app/staff/payments src/app/staff/counter tests/integration/order-flow.test.ts
    git commit -m "feat: create and confirm customer orders"

### Task 8: Mercado Pago Orders API and signed webhooks

**Files:**
- Create: src/modules/payments/payment-gateway.ts
- Create: src/modules/payments/mercado-pago-gateway.ts
- Create: src/modules/payments/fake-payment-gateway.ts
- Create: src/modules/payments/payment-service.ts
- Create: src/modules/payments/webhook-service.ts
- Create: src/app/api/public/orders/[id]/mercado-pago/route.ts
- Create: src/app/api/payments/mercado-pago/webhook/route.ts
- Create: src/app/m/[qrToken]/payment/return/page.tsx
- Test: src/modules/payments/payment-service.test.ts
- Test: src/modules/payments/webhook-service.test.ts
- Test: tests/integration/mercado-pago-webhook.test.ts

**Interfaces:**
- Consumes: AWAITING_PAYMENT order, MERCADOPAGO_ACCESS_TOKEN, webhook secret and APP_URL.
- Produces: createCheckout(order), getRemoteOrder(id), processWebhook(), checkoutUrl.

- [ ] **Step 1: Define and fake the gateway**

    export interface PaymentGateway {
      createCheckout(input: {
        externalReference: string;
        idempotencyKey: string;
        totalCents: number;
        items: Array<{ title: string; quantity: number; unitPriceCents: number }>;
        notificationUrl: string;
        successUrl: string;
        failureUrl: string;
        pendingUrl: string;
      }): Promise<{ providerOrderId: string; checkoutUrl: string; raw: unknown }>;

      getOrder(providerOrderId: string): Promise<{
        providerOrderId: string;
        externalReference: string;
        status: string;
        statusDetail: string;
        totalPaidCents: number;
        raw: unknown;
      }>;
    }

FakePaymentGateway returns deterministic test URLs and exposes approve(providerOrderId) for integration tests.

- [ ] **Step 2: Write failing checkout tests**

Test that one PaymentAttempt gets one UUID idempotency key, repeated checkout requests reuse that attempt, amount comes from Order.totalCents and an order belonging to another customer returns 404.

- [ ] **Step 3: Implement Checkout Pro through Orders API**

Use the official Mercado Pago Node SDK where it exposes Orders API. If the SDK lacks a typed Orders API method, use server-side fetch against POST https://api.mercadopago.com/v1/orders and GET /v1/orders/{id}, still using WebhookSignatureValidator from the official SDK.

Send X-Idempotency-Key, type online, external_reference equal to the local order ID, total_amount formatted with two decimals, items, success/failure/pending URLs and the HTTPS webhook URL. Never expose the access token to the browser.

Apply a database-backed limit of 10 new checkout attempts per order and customer session per 15 minutes. Reusing the existing payment attempt and idempotency key does not consume another slot.

- [ ] **Step 4: Write failing webhook tests**

Cover:

- Missing or invalid x-signature returns 401 and changes nothing.
- Valid processed/accredited status with matching external reference and amount confirms the order.
- Pending leaves the order AWAITING_PAYMENT.
- Failed marks the PaymentAttempt REJECTED without sending the order to the queue.
- The same webhook delivered twice creates one status event.
- A remote amount mismatch leaves the order unchanged and writes a PAYMENT_AMOUNT_MISMATCH audit event.

- [ ] **Step 5: Implement signed webhook processing**

Read x-signature, x-request-id and the data.id query parameter. Validate using:

    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret: env.MERCADOPAGO_WEBHOOK_SECRET
    });

After validation, retrieve the order from Mercado Pago instead of trusting the request body. Accept only status processed with status_detail accredited, matching external_reference and exact total. Apply the payment and order transitions in one idempotent database transaction.

- [ ] **Step 6: Build payment redirect and return UX**

The checkout endpoint returns checkoutUrl. The browser redirects there. The return page says Estamos verificando tu pago and polls the local order; it never marks the payment approved from URL query parameters.

- [ ] **Step 7: Verify and commit**

Run:

    npm test -- src/modules/payments
    npm run test:integration -- tests/integration/mercado-pago-webhook.test.ts

Expected: PASS, including duplicate and amount-mismatch cases.

Commit:

    git add src/modules/payments src/app/api/public/orders src/app/api/payments src/app/m tests/integration/mercado-pago-webhook.test.ts
    git commit -m "feat: integrate Mercado Pago checkout"

### Task 9: Command board and concurrency-safe preparation

**Files:**
- Create: src/modules/orders/command-service.ts
- Create: src/modules/orders/command-contracts.ts
- Create: src/app/api/staff/commands/route.ts
- Create: src/app/api/staff/orders/[id]/transition/route.ts
- Create: src/app/api/staff/order-items/[id]/transition/route.ts
- Create: src/app/staff/commands/page.tsx
- Create: src/app/staff/commands/command-board.tsx
- Test: src/modules/orders/command-service.test.ts
- Test: tests/integration/command-concurrency.test.ts

**Interfaces:**
- Consumes: confirmed orders, item station/status, expectedVersion and StaffPrincipal.
- Produces: active command projection and transitionOrder()/transitionItem().

- [ ] **Step 1: Write failing command projection tests**

Assert that:

- AWAITING_PAYMENT orders never appear.
- CONFIRMED, PREPARING and READY orders appear oldest first.
- GENERAL view includes all items.
- KITCHEN and BAR filter by snapshot station.
- Customer nickname and table label appear, but no payment provider payload appears.

- [ ] **Step 2: Write failing concurrency tests**

Load order version 3 in two simulated requests. The first moves CONFIRMED to PREPARING and version to 4. The second tries CONFIRMED to CANCELLED with expectedVersion 3 and receives 409 ORDER_VERSION_CONFLICT. The final state remains PREPARING with one status event.

- [ ] **Step 3: Implement item and order transitions**

Use updateMany with id, expected version and current status in the WHERE clause. Item rules:

    QUEUED -> PREPARING -> READY -> DELIVERED

Derive order status:

- Any item PREPARING makes a CONFIRMED order PREPARING.
- All items READY makes the order READY.
- All items DELIVERED makes the order DELIVERED.

Every transition records actor, time and event in the same transaction.

- [ ] **Step 4: Build the command board**

Use large touch targets, high contrast status columns, elapsed time, table, nickname, delivery type and item options. Add station filter but default to GENERAL. Require confirmation for cancellation and display conflicts by refreshing the card.

- [ ] **Step 5: Verify and commit**

Run:

    npm test -- src/modules/orders/command-service.test.ts
    npm run test:integration -- tests/integration/command-concurrency.test.ts

Expected: PASS.

Commit:

    git add src/modules/orders/command-service.ts src/modules/orders/command-contracts.ts src/app/api/staff/commands src/app/api/staff/orders src/app/api/staff/order-items src/app/staff/commands tests/integration/command-concurrency.test.ts
    git commit -m "feat: add command preparation board"

### Task 10: Realtime updates, reconnect, and ready notification

**Files:**
- Create: src/modules/realtime/publisher.ts
- Create: src/modules/realtime/subscriber.ts
- Create: src/modules/realtime/events.ts
- Create: src/app/api/public/orders/[id]/events/route.ts
- Create: src/app/api/staff/commands/events/route.ts
- Create: src/lib/client/use-sse-resource.ts
- Modify: src/app/m/[qrToken]/orders/[id]/page.tsx
- Modify: src/app/staff/commands/command-board.tsx
- Test: src/modules/realtime/events.test.ts
- Test: src/lib/client/use-sse-resource.test.tsx
- Test: tests/integration/realtime-reconnect.test.ts

**Interfaces:**
- Consumes: committed order events from Tasks 7–9.
- Produces: SSE event type order.changed with orderId, version and occurredAt; authenticated customer/staff streams.

- [ ] **Step 1: Write failing event serialization tests**

    expect(encodeSse({
      type: "order.changed",
      orderId: "order-1",
      version: 4,
      occurredAt: "2026-09-21T20:00:00.000Z"
    })).toBe(
      "event: order.changed\\ndata: {\"orderId\":\"order-1\",\"version\":4,\"occurredAt\":\"2026-09-21T20:00:00.000Z\"}\\n\\n"
    );

Reject payloads above 4 KB and payloads with unknown event types.

- [ ] **Step 2: Implement PostgreSQL publication and subscription**

publisher executes SELECT pg_notify('appqr_order_events', jsonPayload) inside the same Prisma transaction as the state change. subscriber uses one dedicated pg client per application process and fans events to matching in-process SSE listeners. Reconnect the PostgreSQL listener with capped exponential backoff.

- [ ] **Step 3: Implement authorized SSE routes**

Customer stream checks the customer_session cookie and order ownership before opening. Staff stream requires a valid staff session. Both send a heartbeat comment every 20 seconds and close resources on request.signal abort.

- [ ] **Step 4: Implement reconnecting client hook**

useSseResource opens EventSource, invokes refetch immediately after open or error recovery, and runs a 15-second polling fallback while EventSource is not OPEN. The event itself triggers a full GET; it is a hint, not the source of truth.

- [ ] **Step 5: Add ready notification**

When the customer view observes its first transition to READY, show a persistent visual banner and call Audio.play only after the page has received a prior user gesture. If sound is blocked, the visual banner remains sufficient.

- [ ] **Step 6: Test reconnection**

The integration test disconnects the subscriber, changes CONFIRMED to READY, reconnects, calls GET /api/public/orders/:id and proves the client receives READY despite missing the transient event.

- [ ] **Step 7: Verify and commit**

Run:

    npm test -- src/modules/realtime src/lib/client/use-sse-resource.test.tsx
    npm run test:integration -- tests/integration/realtime-reconnect.test.ts

Expected: PASS.

Commit:

    git add src/modules/realtime src/app/api/public/orders src/app/api/staff/commands src/lib/client src/app/m src/app/staff/commands tests/integration/realtime-reconnect.test.ts
    git commit -m "feat: stream order status updates"

### Task 11: Operating settings, users, sessions, and audit

**Files:**
- Create: src/modules/operations/settings-service.ts
- Create: src/modules/auth/user-admin-service.ts
- Create: src/modules/audit/audit-service.ts
- Create: src/app/api/staff/settings/route.ts
- Create: src/app/api/staff/users/route.ts
- Create: src/app/api/staff/customer-sessions/[id]/close/route.ts
- Create: src/app/api/staff/payments/[id]/reconciliation/route.ts
- Create: src/app/api/staff/audit/route.ts
- Create: src/app/staff/settings/page.tsx
- Create: src/app/staff/users/page.tsx
- Create: src/app/staff/audit/page.tsx
- Create: src/app/manifest.ts
- Create: src/app/pwa-register.tsx
- Create: src/app/offline/page.tsx
- Create: public/sw.js
- Create: public/icons/icon-192.png
- Create: public/icons/icon-512.png
- Modify: src/app/layout.tsx
- Test: src/modules/operations/settings-service.test.ts
- Test: tests/integration/admin-authorization.test.ts

**Interfaces:**
- Consumes: ADMIN principal for settings, users and payment reconciliation; ADMIN or OPERATOR for session close and permitted mode changes.
- Produces: weekly service windows, manual override, user lifecycle, manual refund record, audit query and installable PWA metadata.

- [ ] **Step 1: Write failing settings tests**

Validate weekday 0–6, minute 0–1439, opening different from cutoff, one window per weekday, valid IANA timezone and manual modes. Prove OPERATOR cannot edit weekly windows, users or payment reconciliation. Allow OPERATOR to FORCE_PAUSED and return to SCHEDULED; reserve FORCE_QR_OPEN and FORCE_COUNTER_ONLY for ADMIN. Prove ADMIN can record a partial refund but cannot record refundedCents above the paid amount.

- [ ] **Step 2: Implement settings and user administration**

All settings writes run transactionally and create AuditEvent with before/after values. User creation hashes the password; deactivation revokes all sessions. Prevent the last active administrator from being deactivated.

- [ ] **Step 3: Implement customer session closure and audit search**

Closing a session sets closedAt, expires its cookie on the matching client at the next request and never deletes orders. Audit search filters action, actor, entity and date with a maximum page size of 100.

Add an administrator-only payment reconciliation endpoint accepting providerOrderId, target status REFUNDED or PARTIALLY_REFUNDED, refundedCents and a required note. It records the already-completed external refund; it does not call Mercado Pago. Validate refundedCents is positive and does not exceed amountCents, update the payment and add an AuditEvent in one transaction.

- [ ] **Step 4: Build settings, users, and audit pages**

The settings page uses seven rows with opening, cutoff and enabled controls, clearly indicating windows that end the next day. The current effective mode is always visible. Manual overrides show who applied them and provide a return-to-schedule action.

- [ ] **Step 5: Add PWA metadata and conservative service worker**

manifest.ts names the app Pedidos QR, uses standalone display and references the 192 px and 512 px icons. pwa-register.tsx registers /sw.js from the root layout after the first client render. public/sw.js caches only versioned static assets and /offline. It must not cache authenticated API responses, order status, payments or staff pages. Cart persistence remains in localStorage.

- [ ] **Step 6: Verify and commit**

Run:

    npm test -- src/modules/operations/settings-service.test.ts
    npm run test:integration -- tests/integration/admin-authorization.test.ts
    npm run build

Expected: PASS.

Commit:

    git add src/modules/operations src/modules/auth/user-admin-service.ts src/modules/audit src/app/api/staff/settings src/app/api/staff/users src/app/api/staff/customer-sessions src/app/api/staff/payments src/app/api/staff/audit src/app/staff/settings src/app/staff/users src/app/staff/audit src/app/manifest.ts src/app/pwa-register.tsx src/app/offline src/app/layout.tsx public/sw.js public/icons tests/integration/admin-authorization.test.ts
    git commit -m "feat: administer daily operations"

### Task 12: Security, observability, and production packaging

**Files:**
- Create: src/lib/http/problem.ts
- Create: src/lib/http/request-id.ts
- Create: src/lib/security/csrf.ts
- Create: src/lib/security/headers.ts
- Create: src/lib/logger.ts
- Create: src/app/api/ready/route.ts
- Create: Dockerfile
- Modify: next.config.ts
- Create: docs/runbooks/deployment.md
- Create: docs/runbooks/backup-and-restore.md
- Create: docs/runbooks/payment-incident.md
- Test: src/lib/security/csrf.test.ts
- Test: tests/integration/readiness.test.ts

**Interfaces:**
- Consumes: all HTTP routes and deployment environment.
- Produces: consistent problem responses, request IDs, CSRF defense, security headers, structured logs, liveness/readiness and one production image.

- [ ] **Step 1: Write failing security tests**

Prove that staff mutation routes reject a mismatched Origin, public payment webhooks bypass browser CSRF but require provider signature, errors omit stack traces in production, and logs redact cookies, authorization, access tokens and provider payloads.

- [ ] **Step 2: Implement HTTP and security middleware helpers**

Use application/problem+json:

    {
      "type": "https://app.example/problems/order-version-conflict",
      "title": "El pedido cambió",
      "status": 409,
      "code": "ORDER_VERSION_CONFLICT",
      "requestId": "generated-request-id"
    }

Apply Content-Security-Policy, frame-ancestors 'none', nosniff, strict referrer policy and HSTS in production. Validate Origin against APP_URL for staff/browser mutations.

- [ ] **Step 3: Add structured logging and readiness**

Log requestId, route, status, duration and stable error code. Do not log request bodies on auth or payment routes. /api/health remains liveness without external dependencies. /api/ready performs SELECT 1 and returns 503 if PostgreSQL is unavailable.

- [ ] **Step 4: Create the production image**

Use a multi-stage Dockerfile:

- Node 24 bookworm-slim dependency stage with npm ci so native Argon2 modules use glibc consistently.
- Build stage running prisma generate and next build.
- Runtime stage copying Next standalone output, static files and Prisma migrations.
- Non-root user, NODE_ENV=production and port 3000.
- Container health check against /api/health using the Node runtime rather than an extra curl package.

The release command runs npm run db:deploy once before starting the new application revision.

- [ ] **Step 5: Write operational runbooks**

deployment.md contains exact environment variables, HTTPS/domain requirement, webhook URL, S3 bucket CORS, migration order, rollback and smoke checks. backup-and-restore.md defines daily encrypted PostgreSQL backup, 30-day retention and quarterly restore test. payment-incident.md covers webhook outage, reconciliation by providerOrderId, amount mismatch and manual refund recording.

- [ ] **Step 6: Verify and commit**

Run:

    npm test -- src/lib/security
    npm run test:integration -- tests/integration/readiness.test.ts
    npm run lint
    npm run typecheck
    npm run build
    docker build -t app-qr:local .

Expected: all commands pass and the image health endpoint returns 200 when DATABASE_URL is available.

Commit:

    git add src/lib src/app/api/ready Dockerfile next.config.ts docs/runbooks tests/integration/readiness.test.ts
    git commit -m "chore: harden production runtime"

### Task 13: End-to-end acceptance, corrected proposal, and launch checklist

**Files:**
- Create: playwright.config.ts
- Create: tests/e2e/fixtures.ts
- Create: tests/e2e/customer-traditional.spec.ts
- Create: tests/e2e/mercado-pago.spec.ts
- Create: tests/e2e/cutoff.spec.ts
- Create: tests/e2e/multi-customer-privacy.spec.ts
- Create: tests/e2e/command-board.spec.ts
- Create: docs/propuesta-comercial-corregida.md
- Create: docs/runbooks/local-acceptance.md
- Create: .github/workflows/ci.yml

**Interfaces:**
- Consumes: complete application, fake gateway in test only, seeded test database.
- Produces: automated acceptance suite, corrected client-facing proposal and launch evidence.

- [ ] **Step 1: Configure isolated E2E execution**

playwright.config.ts starts PostgreSQL test services, applies migrations, seeds deterministic data and starts npm run start on port 3100 with PAYMENT_PROVIDER=fake. Run Chromium plus mobile Chrome and mobile Safari projects. Record trace and screenshot only on failure.

- [ ] **Step 2: Implement the traditional payment journey**

Test:

1. Ana opens Mesa 1 and chooses a burger with required options.
2. Ana selects cash and sees Esperando confirmación de caja.
3. Staff logs in and confirms the payment.
4. The command appears.
5. Staff marks preparing, ready and delivered.
6. Ana sees each state and the ready banner.

- [ ] **Step 3: Implement Mercado Pago and idempotency journeys**

With FakePaymentGateway:

1. Create checkout.
2. Deliver pending webhook and verify no command.
3. Approve remotely and deliver the signed test webhook.
4. Deliver the identical webhook again.
5. Verify one approved PaymentAttempt, one CONFIRMED event and one command.

Keep one separate manual sandbox checklist for the real Mercado Pago test account; never put real credentials in Playwright fixtures.

- [ ] **Step 4: Implement cutoff, privacy, and concurrency journeys**

cutoff.spec.ts sets a cross-midnight window and verifies the exact boundary. multi-customer-privacy.spec.ts uses two browser contexts on one table and asserts direct order URL access returns 404 across sessions. command-board.spec.ts creates two simultaneous versioned updates and expects one 200 and one 409 followed by a refreshed correct state.

- [ ] **Step 5: Write the corrected commercial proposal**

docs/propuesta-comercial-corregida.md mirrors the original two-page structure but uses the approved rules:

- QR enabled within the configured service window.
- Existing orders continue after cutoff.
- Los pedidos nuevos después del corte se gestionan en barra o caja.
- Payment confirmation precedes preparation.
- In-page status is guaranteed; push is a later enhancement.
- Delivery estimate is separated into prototype, production implementation and on-site acceptance.
- Hosting, Mercado Pago fees, domain, image storage and ongoing support are listed separately from development.

State a realistic implementation estimate of 4–6 weeks for one experienced engineer, assuming menu content, Mercado Pago account and local feedback are available. Describe 7–12 calendar days only as a demonstrable prototype without production acceptance.

- [ ] **Step 6: Add CI and final verification**

CI jobs:

1. npm ci.
2. npm run lint.
3. npm run typecheck.
4. npm test.
5. Start PostgreSQL and run npm run test:integration.
6. npm run build.
7. Install Playwright browsers and run npm run test:e2e.

Run locally:

    npm run lint
    npm run typecheck
    npm test
    npm run test:integration
    npm run build
    npm run test:e2e

Expected: every command passes with no skipped critical-path test.

- [ ] **Step 7: Execute on-site acceptance**

Use docs/runbooks/local-acceptance.md to record:

- QR scan from at least two Android phones and one iPhone.
- Simultaneous clients at one table.
- Real test payment approved, pending and rejected.
- Traditional payment confirmation.
- Kitchen/tablet reconnect after Wi-Fi interruption.
- Automatic cutoff and manual pause.
- Product sold out while present in a cart.
- QR regeneration invalidating the old code.
- Backup completed before launch and rollback contact assigned.

- [ ] **Step 8: Commit the acceptance package**

Commit:

    git add playwright.config.ts tests/e2e docs/propuesta-comercial-corregida.md docs/runbooks/local-acceptance.md .github/workflows/ci.yml
    git commit -m "test: cover complete bar workflows"

## Effort and Release Recommendation

For one experienced full-stack engineer, the production scope is approximately:

- Foundation, model and authentication: 4–6 working days.
- Catalog, QR and customer ordering: 5–7 working days.
- Payments, command board and realtime: 6–9 working days.
- Administration, security and deployment: 4–6 working days.
- On-site acceptance and corrections: 2–4 working days.

Expected total: **21–32 working days**, normally **4–6 weeks**. A 7–12 calendar-day delivery can cover a prototype with the primary screen flow and test payments, but it should not be represented as the production-ready scope in this plan.

Recommended releases:

1. Internal demo after Task 6.
2. Local pilot with traditional payments after Task 7.
3. Mercado Pago sandbox pilot after Task 10.
4. Controlled production launch after Task 13.

## Verified Technical References

- Next.js installation and Node floor: https://nextjs.org/docs/app/getting-started/installation
- Node.js release schedule: https://nodejs.org/en/about/previous-releases
- PostgreSQL supported versions: https://www.postgresql.org/support/versioning/
- Prisma ORM 7 PostgreSQL setup: https://www.prisma.io/docs/guides/v7/frameworks/nextjs
- Prisma ORM 7 seeding: https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding
- Mercado Pago Orders API: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/create-order
- Mercado Pago signed webhooks: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/notifications
- Next.js testing guide: https://nextjs.org/docs/app/guides/testing
- Playwright installation: https://playwright.dev/docs/intro
