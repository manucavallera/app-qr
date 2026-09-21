"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PendingOrder = { id: string; number: number; customerName: string | null; totalCents: number; version: number; table: { label: string } | null; createdAt: string; payments: { method: "CASH" | "CARD_AT_COUNTER"; status: string }[] };
function ars(cents: number): string { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100); }

export default function StaffPaymentsPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => { const response = await fetch("/api/staff/payments/pending", { cache: "no-store" }); if (response.status === 401) { router.push("/staff/login"); return; } if (response.ok) setOrders(await response.json() as PendingOrder[]); }, [router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  async function confirm(order: PendingOrder) { const method = order.payments.find((payment) => payment.status === "UNPAID")?.method; if (!method) return; const response = await fetch(`/api/staff/orders/${order.id}/confirm-traditional`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method, expectedOrderVersion: order.version }) }); if (!response.ok) { setMessage("El pedido cambió. Actualizá la pantalla."); return; } await refresh(); }
  return <main className="staff-page"><header className="staff-header"><div><p className="eyebrow">Operación</p><h1>Pagos pendientes</h1></div><a className="secondary-button" href="/staff/catalog">Catálogo</a></header>{message && <p className="login-error">{message}</p>}<section className="staff-panel"><div className="panel-heading"><h2>Esperando caja</h2><button className="secondary-button" type="button" onClick={() => void refresh()}>Actualizar</button></div>{orders.length === 0 ? <p className="empty-state">No hay pagos pendientes.</p> : <div className="payment-list">{orders.map((order) => <article className="payment-card" key={order.id}><div><strong>Pedido #{order.number}</strong><span>{order.table?.label ?? "Sin mesa"} · {order.customerName ?? "Cliente QR"}</span><small>{new Date(order.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></div><strong>{ars(order.totalCents)}</strong><button className="primary-link" type="button" onClick={() => void confirm(order)}>Confirmar pago</button></article>)}</div>}</section></main>;
}
