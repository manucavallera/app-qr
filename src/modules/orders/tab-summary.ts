import { z } from "zod";

export const settleTabInputSchema = z.object({
  tabId: z.string().uuid(),
  // Clave de una persona de la cuenta (ver TabPerson.key); sin esto se cobra la cuenta entera.
  personKey: z.string().min(1).max(200).optional(),
  method: z.enum(["CASH", "CARD_AT_COUNTER", "BANK_TRANSFER"]),
}).strict();

export type SettleTabInput = z.infer<typeof settleTabInputSchema>;

export type TabOrder = {
  number: number;
  customerSessionId: string | null;
  personName: string;
  totalCents: number;
  items: { productName: string; quantity: number; lineTotalCents: number }[];
};

export type TabPerson = {
  key: string;
  customerSessionId: string | null;
  name: string;
  totalCents: number;
  orders: TabOrder[];
};

export type TabSummary = { totalCents: number; people: TabPerson[] };

/** Agrupa los pedidos sin cobrar de una mesa por persona, en orden de llegada. */
export function summarizeTab(orders: readonly TabOrder[]): TabSummary {
  const byPerson = new Map<string, TabPerson>();
  for (const order of orders) {
    const key = order.customerSessionId ?? `name:${order.personName}`;
    const person = byPerson.get(key) ?? { key, customerSessionId: order.customerSessionId, name: order.personName, totalCents: 0, orders: [] };
    person.totalCents += order.totalCents;
    person.orders.push(order);
    byPerson.set(key, person);
  }
  const people = [...byPerson.values()];
  return { totalCents: people.reduce((sum, person) => sum + person.totalCents, 0), people };
}
