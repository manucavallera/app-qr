import { Pool, type PoolClient } from "pg";
import { getServerEnv } from "@/lib/env";
import { parseOrderEvent, type OrderChangedEvent } from "./events";

type Listener = (event: OrderChangedEvent) => void;
const listeners = new Map<string, Set<Listener>>();
let clientPromise: Promise<PoolClient> | null = null;

async function connect(): Promise<PoolClient> {
  const pool = new Pool({ connectionString: getServerEnv().DATABASE_URL, max: 1 });
  const client = await pool.connect();
  await client.query("LISTEN appqr_order_events");
  client.on("notification", (notification) => {
    try {
      const event = parseOrderEvent(JSON.parse(notification.payload ?? "{}"));
      for (const listener of [...(listeners.get(event.orderId) ?? []), ...(listeners.get("*") ?? [])]) listener(event);
    } catch { /* malformed notifications are ignored */ }
  });
  client.on("error", () => { clientPromise = null; });
  return client;
}

export async function subscribeOrder(orderId: string, listener: Listener): Promise<() => void> {
  clientPromise ??= connect();
  await clientPromise;
  const orderListeners = listeners.get(orderId) ?? new Set<Listener>();
  orderListeners.add(listener);
  listeners.set(orderId, orderListeners);
  return () => {
    orderListeners.delete(listener);
    if (orderListeners.size === 0) listeners.delete(orderId);
  };
}
