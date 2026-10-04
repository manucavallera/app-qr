import { Client } from "pg";
import { getServerEnv } from "@/lib/env";
import { parseOrderEvent, type OrderChangedEvent } from "./events";

type Listener = (event: OrderChangedEvent) => void;
const ALL_ORDERS = "*";
const RECONNECT_DELAY_MS = 2_000;
const listeners = new Map<string, Set<Listener>>();
let connection: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function dispatch(event: OrderChangedEvent): void {
  for (const listener of [...(listeners.get(event.orderId) ?? []), ...(listeners.get(ALL_ORDERS) ?? [])]) listener(event);
}

// Notifications sent while the LISTEN connection was down are lost, so every
// open stream gets one synthetic event and its client refetches current state.
function resyncListeners(): void {
  const occurredAt = new Date().toISOString();
  for (const [orderId, orderListeners] of listeners) {
    const event: OrderChangedEvent = { type: "order.changed", orderId: orderId === ALL_ORDERS ? "resync" : orderId, version: 0, occurredAt };
    for (const listener of orderListeners) listener(event);
  }
}

function scheduleReconnect(): void {
  if (retryTimer || listeners.size === 0) return;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    if (listeners.size === 0) return;
    void ensureConnected().then(resyncListeners, () => undefined);
  }, RECONNECT_DELAY_MS);
  retryTimer.unref?.();
}

async function connect(): Promise<void> {
  const client = new Client({ connectionString: getServerEnv().DATABASE_URL });
  const drop = () => {
    client.removeAllListeners();
    client.on("error", () => undefined);
    void client.end().catch(() => undefined);
    connection = null;
    scheduleReconnect();
  };
  client.on("error", drop);
  client.on("end", drop);
  client.on("notification", (notification) => {
    try {
      dispatch(parseOrderEvent(JSON.parse(notification.payload ?? "{}")));
    } catch { /* malformed notifications are ignored */ }
  });
  try {
    await client.connect();
    await client.query("LISTEN appqr_order_events");
  } catch (error) {
    drop();
    throw error;
  }
}

function ensureConnected(): Promise<void> {
  connection ??= connect();
  return connection;
}

export async function subscribeOrder(orderId: string, listener: Listener): Promise<() => void> {
  const orderListeners = listeners.get(orderId) ?? new Set<Listener>();
  orderListeners.add(listener);
  listeners.set(orderId, orderListeners);
  const unsubscribe = () => {
    orderListeners.delete(listener);
    if (orderListeners.size === 0 && listeners.get(orderId) === orderListeners) listeners.delete(orderId);
  };
  try {
    await ensureConnected();
  } catch (error) {
    unsubscribe();
    throw error;
  }
  return unsubscribe;
}
