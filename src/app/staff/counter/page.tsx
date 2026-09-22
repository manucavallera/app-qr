"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/staff/staff-shell";

type Product = { id: string; name: string; description: string; priceCents: number; available: boolean; optionGroups: { id: string; name: string; values: { id: string; name: string; priceDeltaCents: number; available: boolean }[] }[] };
type Table = { id: string; label: string; active: boolean };
type CartLine = { product: Product; quantity: number; optionValueIds: string[] };
type RecentOrder = { id: string; number: number; status: string; totalCents: number; customerName: string | null; table: { label: string } | null };

function ars(cents: number): string { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100); }

export default function CounterPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [nickname, setNickname] = useState("");
  const [tableId, setTableId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD_AT_COUNTER">("CASH");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const total = useMemo(() => cart.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0), [cart]);

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
    });
  }, [router]);

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { product, quantity: 1, optionValueIds: [] }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) => current.flatMap((line) => line.product.id === productId ? (line.quantity + delta > 0 ? [{ ...line, quantity: line.quantity + delta }] : []) : [line]));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nickname.trim() || cart.length === 0) { setMessage("Ingresá un nombre y agregá al menos un producto."); return; }
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/staff/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientRequestId: crypto.randomUUID(), expectedTotalCents: total, paymentMethod, nickname: nickname.trim(), tableId: tableId || undefined, items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity, optionValueIds: line.optionValueIds })) }) });
    if (!response.ok) { setMessage("No se pudo crear el pedido. Revisá los datos e intentá de nuevo."); setSaving(false); return; }
    setCart([]);
    setNickname("");
    setTableId("");
    setMessage("Pedido creado y enviado a preparación.");
    setSaving(false);
  }

  return <StaffShell title="Caja" section="counter"><section className="staff-panel counter-layout"><div><p className="eyebrow">Venta presencial</p><h2>Nuevo pedido en caja</h2><p className="muted">Cargá el pedido, cobralo y se enviará directamente a preparación.</p><form className="staff-form" onSubmit={submit}><label className="form-field"><span>Nombre o referencia</span><input className="form-input" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Ej. Juan" required /></label><label className="form-field"><span>Mesa (opcional)</span><select className="form-input" value={tableId} onChange={(event) => setTableId(event.target.value)}><option value="">Pedido de mostrador</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}</select></label><fieldset className="dialog-option-group"><legend>Forma de pago</legend><label className="dialog-option"><input type="radio" checked={paymentMethod === "CASH"} onChange={() => setPaymentMethod("CASH")} /> Efectivo</label><label className="dialog-option"><input type="radio" checked={paymentMethod === "CARD_AT_COUNTER"} onChange={() => setPaymentMethod("CARD_AT_COUNTER")} /> Tarjeta</label></fieldset><div className="counter-products"><h3>Productos</h3>{products.filter((product) => product.available).map((product) => <button className="product-picker" key={product.id} type="button" onClick={() => addProduct(product)}><span><strong>{product.name}</strong><small>{ars(product.priceCents)}</small></span><span aria-hidden="true">+</span></button>)}</div><div className="counter-cart"><h3>Pedido actual</h3>{cart.length === 0 ? <p className="empty-state">Todavía no agregaste productos.</p> : cart.map((line) => <div className="counter-line" key={line.product.id}><span>{line.product.name}</span><div className="quantity-control"><button type="button" aria-label={`Quitar ${line.product.name}`} onClick={() => changeQuantity(line.product.id, -1)}>−</button><strong>{line.quantity}</strong><button type="button" aria-label={`Agregar ${line.product.name}`} onClick={() => changeQuantity(line.product.id, 1)}>+</button></div><strong>{ars(line.product.priceCents * line.quantity)}</strong></div>)}</div>{message && <p className="staff-message" role="status">{message}</p>}<div className="cart-total"><span>Total</span><strong>{ars(total)}</strong></div><button className="primary-link login-button" disabled={saving || cart.length === 0} type="submit">{saving ? "Creando…" : "Crear pedido"}</button></form></div><aside className="counter-recent"><p className="eyebrow">Actividad</p><h2>Últimos pedidos</h2><div className="payment-list">{recentOrders.map((order) => <div className="payment-card" key={order.id}><div><strong>Pedido #{order.number}</strong><span>{order.table?.label ?? "Mostrador"} · {order.customerName ?? "Cliente"}</span></div><span>{order.status}</span></div>)}</div></aside></section></StaffShell>;
}
