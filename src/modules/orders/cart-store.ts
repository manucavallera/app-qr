export type CartItem = Readonly<{
  productId: string;
  optionIds: readonly string[];
  notes: string;
  quantity: number;
  displayedTotalCents: number;
}>;

export type CartStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storageOrNull(): CartStorage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}
function keyFor(qrToken: string): string {
  return `app-qr-cart:${qrToken}`;
}

function validItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return typeof item.productId === "string" && item.productId.length > 0 &&
    Array.isArray(item.optionIds) && item.optionIds.every((id) => typeof id === "string") &&
    typeof item.notes === "string" && Number.isInteger(item.quantity) && item.quantity! > 0 &&
    Number.isInteger(item.displayedTotalCents) && item.displayedTotalCents! >= 0;
}

export function loadCart(qrToken: string, storage = storageOrNull()): CartItem[] {
  if (!storage) return [];
  try {
    const stored: unknown = JSON.parse(storage.getItem(keyFor(qrToken)) ?? "[]");
    return Array.isArray(stored) ? stored.filter(validItem).map((item) => ({
      productId: item.productId,
      optionIds: [...item.optionIds],
      notes: item.notes,
      quantity: item.quantity,
      displayedTotalCents: item.displayedTotalCents,
    })) : [];
  } catch {
    return [];
  }
}

export function saveCart(qrToken: string, items: readonly CartItem[], storage = storageOrNull()): void {
  if (!storage) return;
  const safeItems = items.filter(validItem).map((item) => ({
    productId: item.productId,
    optionIds: [...item.optionIds],
    notes: item.notes,
    quantity: item.quantity,
    displayedTotalCents: item.displayedTotalCents,
  }));
  storage.setItem(keyFor(qrToken), JSON.stringify(safeItems));
}

function selectionKey(item: CartItem): string {
  return JSON.stringify([item.productId, [...item.optionIds].sort(), item.notes.trim()]);
}

export function addToCart(items: readonly CartItem[], addition: CartItem): CartItem[] {
  const key = selectionKey(addition);
  const index = items.findIndex((item) => selectionKey(item) === key);
  if (index < 0) return [...items, { ...addition, optionIds: [...addition.optionIds] }];
  return items.map((item, current) => current === index
    ? { ...item, quantity: item.quantity + addition.quantity, displayedTotalCents: addition.displayedTotalCents }
    : item);
}

export function cartTotal(items: readonly CartItem[]): number {
  return items.reduce((total, item) => total + item.displayedTotalCents * item.quantity, 0);
}
