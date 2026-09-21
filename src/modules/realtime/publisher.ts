import type { OrderChangedEvent } from "./events";

export async function publishOrderChanged(tx: { $executeRaw: (...args: unknown[]) => Promise<number> }, event: OrderChangedEvent): Promise<void> {
  await tx.$executeRaw`SELECT pg_notify('appqr_order_events', ${JSON.stringify(event)})`;
}
