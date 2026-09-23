"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ProductDialog, type MenuProduct } from "@/modules/catalog/components/product-dialog";
import type { CartItem } from "@/modules/orders/cart-store";
import { StaffShell } from "@/components/staff/staff-shell";
import { orderStatusLabel } from "@/components/staff/status-copy";

type Product = MenuProduct;
type Table = { id: string; label: string; active: boolean };
type CartLine = { id: string; product: Product; quantity: number; optionValueIds: string[]; optionLabels: string[]; notes: string; unitPriceCents: number };
type RecentOrder = { id: string; number: number; status: string; totalCents: number; customerName: string | null; table: { label: string } | null };

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
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD_AT_COUNTER">("CASH");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const total = useMemo(() => cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0), [cart]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/staff/catalog/products", { cache: "no-store" }),
      fetch("/api/staff/tables", { cache: "no-store" }),
      fetch("/api/staff/orders", { cache: "no-store" }),
    ]).then(async ([productResponse, tableResponse, orderResponse]) => {
      if ([productResponse, tableResponse, orderResponse].some((response) => response.status === 401)) { router.push("/staff/login"); return; }
      if (productResponse.ok) setProducts(await productResponse.json() as Product[]);
      if (tableResponse.ok) setTables((await tableResponse.json() as Table[]).filter((table) => table.active));
      if (orderResponse.ok) setRecentOrders((await orderResponse.json() as RecentOrder[]).slice(0, 8));
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
      if (!response.ok) { setMessage("No se pudo crear el pedido. Revisá los datos e intentá de nuevo."); return; }
      setCart([]);
      setNickname("");
      setTableId("");
      setMessage("Pedido creado y enviado a preparación.");
    } catch {
      setMessage("No se pudo conectar con el servidor. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return <StaffShell title="Caja" section="counter">
    <section className="staff-panel counter-layout">
      <div>
        <p className="eyebrow">Venta presencial</p>
        <h2>Nuevo pedido en caja</h2>
        <p className="muted">Cargá el pedido, elegí variantes y anotá indicaciones para cocina.</p>
        {loading ? <p className="loading-state" role="status">Cargando productos…</p> : <form className="staff-form" onSubmit={submit}>
          <label className="form-field"><span>Nombre o referencia</span><input className="form-input" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Ej. Juan" required /></label>
          <label className="form-field"><span>Mesa (opcional)</span><select className="form-input" value={tableId} onChange={(event) => setTableId(event.target.value)}><option value="">Pedido de mostrador</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}</select></label>
          <fieldset className="dialog-option-group"><legend>Forma de pago</legend><label className="dialog-option"><input type="radio" checked={paymentMethod === "CASH"} onChange={() => setPaymentMethod("CASH")} /> Efectivo</label><label className="dialog-option"><input type="radio" checked={paymentMethod === "CARD_AT_COUNTER"} onChange={() => setPaymentMethod("CARD_AT_COUNTER")} /> Tarjeta</label></fieldset>
          <div className="counter-products"><h3>Productos</h3>{products.filter((product) => product.available).length === 0 ? <p className="empty-state">No hay productos disponibles.</p> : products.filter((product) => product.available).map((product) => <button className="product-picker" key={product.id} type="button" onClick={() => setSelectedProduct(product)}><span><strong>{product.name}</strong><small>{product.optionGroups.length > 0 ? "Elegir opciones · " : ""}{ars(product.priceCents)}</small></span><span aria-hidden="true">+</span></button>)}</div>
          <div className="counter-cart"><h3>Pedido actual</h3>{cart.length === 0 ? <p className="empty-state">Todavía no agregaste productos.</p> : cart.map((line) => <div className="counter-line" key={line.id}><span><strong>{line.product.name}</strong>{line.optionLabels.length > 0 && <small>{line.optionLabels.join(" · ")}</small>}{line.notes && <small>Nota: {line.notes}</small>}</span><div className="quantity-control"><button type="button" aria-label={`Quitar ${line.product.name}`} onClick={() => changeQuantity(line.id, -1)}>−</button><strong>{line.quantity}</strong><button type="button" aria-label={`Agregar ${line.product.name}`} onClick={() => changeQuantity(line.id, 1)}>+</button></div><strong>{ars(line.unitPriceCents * line.quantity)}</strong></div>)}</div>
          {message && <p className="staff-message" role="status">{message}</p>}
          <div className="cart-total"><span>Total</span><strong>{ars(total)}</strong></div>
          <button className="primary-link login-button" disabled={saving || cart.length === 0} type="submit">{saving ? "Creando…" : "Crear pedido"}</button>
        </form>}
      </div>
      <aside className="counter-recent"><p className="eyebrow">Actividad</p><h2>Últimos pedidos</h2>{recentOrders.length === 0 ? <p className="empty-state">Todavía no hay pedidos recientes.</p> : <div className="payment-list">{recentOrders.map((order) => <div className="payment-card" key={order.id}><div><strong>Pedido #{order.number}</strong><span>{order.table?.label ?? "Mostrador"} · {order.customerName ?? "Cliente"}</span></div><span>{orderStatusLabel[order.status] ?? order.status}</span></div>)}</div>}</aside>
    </section>
    {selectedProduct && <ProductDialog product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(item) => addProduct(item, selectedProduct)} />}
  </StaffShell>;
}
