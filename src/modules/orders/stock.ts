import type { Prisma } from "../../generated/prisma/client";
import { DomainError } from "./errors";

type Tx = Prisma.TransactionClient;

/** At or below this many units, staff and customers are told stock is running out. */
export const LOW_STOCK_THRESHOLD = 5;

/** A product with no stock quantity is unlimited. */
export function hasStock(stockQuantity: number | null): boolean {
  return stockQuantity === null || stockQuantity > 0;
}

/**
 * Takes the ordered units out of stock when the order is created, so two
 * customers cannot both buy the last unit. Unpaid orders give them back
 * through releaseOrderStock when they are rejected or expire.
 */
export async function reserveStock(tx: Tx, items: readonly { productId: string; quantity: number }[]): Promise<void> {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);

  // Sorted so concurrent orders lock product rows in the same order.
  for (const productId of [...totals.keys()].sort()) {
    const quantity = totals.get(productId)!;
    const product = await tx.product.findUnique({ where: { id: productId }, select: { name: true, stockQuantity: true } });
    if (!product || product.stockQuantity === null) continue;

    const updated = await tx.product.updateMany({
      where: { id: productId, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    });
    if (updated.count === 0) {
      throw new DomainError("INSUFFICIENT_STOCK", `No queda stock suficiente de ${product.name}.`, {
        productName: product.name,
        available: product.stockQuantity,
      });
    }
  }
}

/** Returns a cancelled order's units to stock. Unlimited products are left alone. */
export async function releaseOrderStock(tx: Tx, orderId: string): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId, productId: { not: null } }, select: { productId: true, quantity: true } });
  for (const item of items) {
    await tx.product.updateMany({
      where: { id: item.productId!, stockQuantity: { not: null } },
      data: { stockQuantity: { increment: item.quantity } },
    });
  }
}
