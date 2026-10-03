"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatArs } from "@/lib/format";
import { useSseResource } from "@/lib/client/use-sse-resource";
import { StaffShell } from "@/components/staff/staff-shell";
import { fulfillmentLabel, orderOriginLabel, orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from "@/components/staff/status-copy";

type Order = {
  id: string;
  number: number;
  origin: string;
  status: string;
  version: number;
  totalCents: number;
  createdAt: string;
  table: { label: string } | null;
  customerName: string | null;
  items: Array<{ id: string; productName: string; quantity: number; lineTotalCents: number; fulfillment: string; notes: string | null; options: Array<{ groupName: string; valueName: string }> }>;
  payments: Array<{ method: string; status: string; amountCents: number }>;
};

const ars = formatArs;

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/orders", { cache: "no-store" });
      if (response.status === 401) { router.push("/staff/login"); return; }
      if (!response.ok) throw new Error("orders_load_failed");
      setOrders(await response.json() as Order[]);
      setLastUpdated(new Date());
    } catch {
      setError("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadOrders(true); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadOrders]);

  const refreshQuietly = useCallback(() => loadOrders(false), [loadOrders]);
  useSseResource("/api/staff/commands/events", refreshQuietly);

  const cancelDialog = useRef<HTMLDialogElement>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  function askCancel(order: Order) {
    setCancelTarget(order);
    setCancelReason("Cancelado desde Pedidos");
    cancelDialog.current?.showModal();
  }

  async function confirmCancel() {
    const order = cancelTarget;
    cancelDialog.current?.close();
    if (!order) return;
    const reason = cancelReason;
    setMessage(null);
    const response = await fetch(`/api/staff/orders/${order.id}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetStatus: "CANCELLED", expectedVersion: order.version, reason: reason.trim() || undefined }),
    });
    if (!response.ok) { setMessage("No se pudo cancelar. El pedido pudo haber cambiado; actualizá la lista."); return; }
    setMessage(`Pedido #${order.number} cancelado.`);
    await loadOrders(false);
  }

  return <StaffShell title="Pedidos" section="orders">
    <dialog ref={cancelDialog} className="staff-panel" aria-labelledby="cancel-title" onClose={() => setCancelTarget(null)}>
      <form method="dialog" onSubmit={(event) => { event.preventDefault(); void confirmCancel(); }}>
        <h2 id="cancel-title">Cancelar pedido #{cancelTarget?.number}</h2>
        <label className="form-field">Motivo (opcional)
          <input className="form-input" maxLength={160} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
        </label>
        <div className="order-footer">
          <button className="button-secondary" type="button" onClick={() => cancelDialog.current?.close()}>Volver</button>
          <button className="button-text danger-text" type="submit">Cancelar pedido</button>
        </div>
      </form>
    </dialog>
    <section className="staff-panel">
      <div className="panel-heading"><div><p className="eyebrow">Historial y seguimiento</p><h2>Pedidos del local</h2><p className="muted">Revisá el detalle, el origen y el estado de cada pedido.{lastUpdated ? ` · Actualizado ${lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</p></div><button className="button-secondary" type="button" onClick={() => void loadOrders(true)}>Actualizar</button></div>
      {message && <p className="staff-message" role="status">{message}</p>}
      {loading ? <p className="loading-state" role="status">Cargando pedidos…</p> : error ? <div className="state-block"><p className="error-state" role="alert">{error}</p><button className="button-secondary" type="button" onClick={() => void loadOrders(true)}>Reintentar</button></div> : orders.length === 0 ? <p className="empty-state">Todavía no hay pedidos para mostrar.</p> : <div className="orders-list">{orders.map((order) => <article className="order-card" key={order.id}>
        <div className="panel-heading"><div><strong>Pedido #{order.number}</strong><span className="order-meta">{orderOriginLabel[order.origin] ?? order.origin} · {order.table?.label ?? "Mostrador"} · {order.customerName ?? "Cliente"}</span><small>{new Date(order.createdAt).toLocaleString("es-AR")}</small></div><span className="status-badge">{orderStatusLabel[order.status] ?? order.status}</span></div>
        <ul className="order-items">{order.items.map((item) => <li key={item.id}><span><strong>{item.quantity} × {item.productName}</strong><small>{item.options.map((option) => `${option.groupName}: ${option.valueName}`).join(" · ")}{item.notes ? `${item.options.length > 0 ? " · " : ""}Nota: ${item.notes}` : ""}</small></span><span>{fulfillmentLabel[item.fulfillment] ?? item.fulfillment} · {ars(item.lineTotalCents)}</span></li>)}</ul>
        <div className="order-footer"><div>{order.payments.map((payment, index) => <small key={`${payment.method}-${index}`}>{paymentMethodLabel(payment.method as Parameters<typeof paymentMethodLabel>[0])}: {paymentStatusLabel(payment.status)}</small>)}</div><strong>{ars(order.totalCents)}</strong></div>
        {order.status !== "CANCELLED" && <a className="button-text" href={`/staff/orders/${order.id}/comprobante`} target="_blank" rel="noreferrer">Comprobante</a>}
        {!['DELIVERED', 'CANCELLED'].includes(order.status) && <button className="button-text danger-text" type="button" onClick={() => askCancel(order)}>Cancelar pedido</button>}
      </article>)}{orders.length >= 50 && <p className="muted" style={{ textAlign: "center", padding: "12px 0" }}>Mostrando los últimos 50 pedidos. Los anteriores quedan en el historial completo.</p>}</div>}
    </section>
  </StaffShell>;
}
