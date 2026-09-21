import { z } from "zod";

const orderEventSchema = z.object({ type: z.literal("order.changed"), orderId: z.string().min(1), version: z.number().int().nonnegative(), occurredAt: z.string().datetime() }).strict();
export type OrderChangedEvent = z.infer<typeof orderEventSchema>;
export type RealtimeEvent = OrderChangedEvent;

export function parseOrderEvent(value: unknown): RealtimeEvent {
  const parsed = orderEventSchema.parse(value);
  if (JSON.stringify(parsed).length > 4096) throw new Error("Realtime event exceeds 4 KB");
  return parsed;
}

export function encodeSse(event: RealtimeEvent): string {
  const parsed = parseOrderEvent(event);
  const payload = JSON.stringify({ orderId: parsed.orderId, version: parsed.version, occurredAt: parsed.occurredAt });
  return `event: ${parsed.type}\ndata: ${payload}\n\n`;
}
