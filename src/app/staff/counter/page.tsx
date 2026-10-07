"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ProductDialog, type MenuProduct } from "@/modules/catalog/components/product-dialog";
import type { CartItem } from "@/modules/orders/cart-store";
import { StaffShell } from "@/components/staff/staff-shell";
import { orderStatusLabel } from "@/components/staff/status-copy";
import { counterOrderConfirmationMessage, type CounterPaymentMethod } from "@/modules/orders/counter-payment";

type Product = MenuProduct;
type Table = { id: string; label: string; active: boolean };
type CartLine = { id: string; product: Product; quantity: number; optionValueIds: string[]; optionLabels: string[]; notes: string; unitPriceCents: number };
type RecentOrder = { id: string; number: number; status: string; totalCents: number; customerName: string | null; table: { label: string } | null };
type PaymentAvailability = { cash: boolean; card: boolean; transfer: boolean; mercadoPago: boolean; tab: boolean };
const paidNowMethod = (available: PaymentAvailability): CounterPaymentMethod => available.cash ? "CASH" : available.card ? "CARD_AT_COUNTER" : available.transfer ? "BANK_TRANSFER" : "MERCADO_PAGO";

function ars(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100);
}

function lineKey(productId: string, optionIds: readonly string[], notes: string): string {
  return JSON.stringify([productId, [...optionIds].sort(), notes.trim()]);
}

function selectedLabels(product: Product, optionIds: readonly string[]): string[] {
  return product.optionGroups.flatMap((group) => group.values.filter((value) => optionIds.includes(value.id)).map((value) => value.name));
}

export default function CounterPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [nickname, setNickname] = useState("");
  const [tableId, setTableId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<CounterPaymentMethod>("CASH");
  const [paymentAvailability, setPaymentAvailability] = useState<PaymentAvailability>({ cash: true, card: true, transfer: false, mercadoPago: false, tab: false });
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const total = useMemo(() => cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0), [cart]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/staff/catalog/products", { cache: "no-store" }),
      fetch("/api/staff/tables", { cache: "no-store" }),
      fetch("/api/staff/orders", { cache: "no-store" }),
      fetch("/api/staff/settings", { cache: "no-store" }),
    ]).then(async ([productResponse, tableResponse, orderResponse, settingsResponse]) => {
      if ([productResponse, tableResponse, orderResponse, settingsResponse].some((response) => response.status === 401)) { router.push("/staff/login"); return; }
      if (productResponse.ok) setProducts(await productResponse.json() as Product[]);
      if (tableResponse.ok) setTables((await tableResponse.json() as Table[]).filter((table) => table.active));
      if (orderResponse.ok) setRecentOrders((await orderResponse.json() as RecentOrder[]).slice(0, 8));
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json() as { paymentSettings?: { mercadoPagoEnabled?: boolean; cashEnabled?: boolean; cardAtCounterEnabled?: boolean; bankTransferEnabled?: boolean; tabEnabled?: boolean; bankAlias?: string | null; bankCbuCvu?: string | null }; mercadoPagoConfigured?: boolean };
        const payment = settings.paymentSettings;
        const nextAvailability = {
          cash: payment?.cashEnabled ?? true,
          card: payment?.cardAtCounterEnabled ?? true,
          transfer: Boolean(payment?.bankTransferEnabled && (payment.bankAlias?.trim() || payment.bankCbuCvu?.trim())),
          mercadoPago: Boolean(payment?.mercadoPagoEnabled && settings.mercadoPagoConfigured),
          tab: Boolean(payment?.tabEnabled),
        };
        setPaymentAvailability(nextAvailability);
        setPaymentMethod((current) => current === "CASH" && nextAvailability.cash || current === "CARD_AT_COUNTER" && nextAvailability.card || current === "BANK_TRANSFER" && nextAvailability.transfer || current === "MERCADO_PAGO" && nextAvailability.mercadoPago || current === "ON_TAB" && nextAvailability.tab ? current : paidNowMethod(nextAvailability));
      }
    }).catch(() => setMessage("No se pudo cargar la caja. Actualizá la pantalla e intentá de nuevo.")).finally(() => setLoading(false));
  }, [router]);

  function addProduct(item: CartItem, product: Product) {
    const key = lineKey(product.id, item.optionIds, item.notes);
    setCart((current) => {
      const existing = current.find((line) => line.id === key);
      if (existing) return current.map((line) => line.id === key ? { ...line, quantity: line.quantity + item.quantity } : line);
      return [...current, { id: key, product, quantity: item.quantity, optionValueIds: [...item.optionIds], optionLabels: selectedLabels(product, item.optionIds), notes: item.notes, unitPriceCents: item.displayedTotalCents }];
    });
    setSelectedProduct(null);
  }

  function changeQuantity(lineId: string, delta: number) {
    setCart((current) => current.flatMap((line) => line.id === lineId ? (line.quantity + delta > 0 ? [{ ...line, quantity: line.quantity + delta }] : []) : [line]));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nickname.trim() || cart.length === 0) { setMessage("Ingresá un nombre y agregá al menos un producto."); return; }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/staff/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientRequestId: crypto.randomUUID(), expectedTotalCents: total, paymentMethod, nickname: nickname.trim(), tableId: tableId || undefined, items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity, optionValueIds: line.optionValueIds, ...(line.notes ? { notes: line.notes } : {}) })) }),
      });
      const body = await response.json() as { status?: string; payments?: { method?: CounterPaymentMethod }[]; paymentQrDataUrl?: string; error?: string; productName?: string; available?: number };
      if (!response.ok) { setMessage(body.error === "INSUFFICIENT_STOCK" ? `No hay stock suficiente de ${body.productName ?? "un producto"} (quedan ${body.available ?? 0}).` : "No se pudo crear el pedido. Revisá los datos e intentá de nuevo."); return; }
      setCart([]);
      setNickname("");
      setTableId("");
      // Sin mesa no hay cuenta a la que sumar el próximo pedido.
      setPaymentMethod((current) => current === "ON_TAB" ? paidNowMethod(paymentAvailability) : current);
      setPaymentQrDataUrl(body.paymentQrDataUrl ?? null);
      setMessage(counterOrderConfirmationMessage(paymentMethod, body.status ?? "CONFIRMED"));
    } catch {
      setMessage("No se pudo conectar con el servidor. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return <StaffShell title="Nuevo pedido" section="counter">
    <section className="staff-panel counter-layout">
      <div>
        <p className="eyebrow">Venta presencial</p>
        <h2>Armá el pedido del mostrador</h2>
        <p className="muted">Cargá el pedido, elegí variantes y anotá indicaciones para cocina.</p>
        {loading ? <p className="loading-state" role="status">Cargando productos…</p> : <form className="staff-form" onSubmit={submit}>
          <label className="form-field"><span>Nombre o referencia</span><input className="form-input" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Ej. Juan" required /></label>
          <label className="form-field"><span>Mesa (opcional)</span><select className="form-input" value={tableId} onChange={(event) => { setTableId(event.target.value); if (!event.target.value) setPaymentMethod((current) => current === "ON_TAB" ? paidNowMethod(paymentAvailability) : current); }}><option value="">Pedido de mostrador</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}</select></label>
          <fieldset className="dialog-option-group"><legend>Forma de pago</legend>{paymentAvailability.cash && <label className="dialog-option"><input type="radio" name="counter-payment" checked={paymentMethod === "CASH"} onChange={() => setPaymentMethod("CASH")} /> Efectivo</label>}{paymentAvailability.card && <label className="dialog-option"><input type="radio" name="counter-payment" checked={paymentMethod === "CARD_AT_COUNTER"} onChange={() => setPaymentMethod("CARD_AT_COUNTER")} /> Tarjeta</label>}{paymentAvailability.transfer && <label className="dialog-option"><input type="radio" name="counter-payment" checked={paymentMethod === "BANK_TRANSFER"} onChange={() => setPaymentMethod("BANK_TRANSFER")} /> Transferencia manual</label>}{paymentAvailability.mercadoPago && <label className="dialog-option"><input type="radio" name="counter-payment" checked={paymentMethod === "MERCADO_PAGO"} onChange={() => setPaymentMethod("MERCADO_PAGO")} /> QR de Mercado Pago</label>}{paymentAvailability.tab && tableId && <label className="dialog-option"><input type="radio" name="counter-payment" checked={paymentMethod === "ON_TAB"} onChange={() => setPaymentMethod("ON_TAB")} /> A la cuenta de la mesa (se cobra al final)</label>}</fieldset>
          <div className="counter-products"><h3>Productos</h3>{products.filter((product) => product.available).length === 0 ? <p className="empty-state">No hay productos disponibles.</p> : products.filter((product) => product.available).map((product) => { const soldOut = product.stockLeft === 0; return <button className={`product-picker${soldOut ? " is-sold-out" : ""}`} key={product.id} type="button" disabled={soldOut} aria-label={soldOut ? `${product.name}, agotado` : undefined} onClick={() => setSelectedProduct(product)}><span><strong>{product.name}</strong><small>{product.optionGroups.length > 0 ? "Elegir opciones · " : ""}{ars(product.priceCents)}{soldOut ? " · Agotado" : product.stockLeft ? ` · Quedan ${product.stockLeft}` : ""}</small></span><span aria-hidden="true">{soldOut ? "" : "+"}</span></button>; })}</div>
          <div className="counter-cart"><h3>Pedido actual</h3>{cart.length === 0 ? <p className="empty-state">Todavía no agregaste productos.</p> : cart.map((line) => <div className="counter-line" key={line.id}><span><strong>{line.product.name}</strong>{line.optionLabels.length > 0 && <small>{line.optionLabels.join(" · ")}</small>}{line.notes && <small>Nota: {line.notes}</small>}</span><div className="quantity-control"><button type="button" aria-label={`Quitar ${line.product.name}`} onClick={() => changeQuantity(line.id, -1)}>−</button><strong>{line.quantity}</strong><button type="button" aria-label={`Agregar ${line.product.name}`} onClick={() => changeQuantity(line.id, 1)}>+</button></div><strong>{ars(line.unitPriceCents * line.quantity)}</strong></div>)}</div>
          {message && <p className="staff-message" role="status">{message}</p>}
          <div className="cart-total"><span>Total</span><strong>{ars(total)}</strong></div>
          <button className="primary-link login-button" disabled={saving || cart.length === 0} type="submit">{saving ? "Creando…" : "Crear pedido"}</button>
        </form>}
      </div>
      <aside className="counter-recent"><p className="eyebrow">Actividad</p><h2>Últimos pedidos</h2>{recentOrders.length === 0 ? <p className="empty-state">Todavía no hay pedidos recientes.</p> : <div className="payment-list">{recentOrders.map((order) => <div className="payment-card" key={order.id}><div><strong>Pedido #{order.number}</strong><span>{order.table?.label ?? "Mostrador"} · {order.customerName ?? "Cliente"}</span></div><span>{orderStatusLabel[order.status] ?? order.status}</span></div>)}</div>}</aside>
    </section>
    {paymentQrDataUrl && <aside className="payment-qr-panel" role="status"><strong>QR de pago</strong><p>El cliente debe escanear y completar el pago. El pedido se confirma automáticamente cuando Mercado Pago lo acredita.</p><Image unoptimized width={240} height={240} src={paymentQrDataUrl} alt="QR para pagar el pedido" /><button className="button-secondary" type="button" onClick={() => setPaymentQrDataUrl(null)}>Cerrar QR</button></aside>}
    {selectedProduct && <ProductDialog product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(item) => addProduct(item, selectedProduct)} />}
  </StaffShell>;
}
