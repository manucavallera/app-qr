"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/staff/staff-shell";
import { paymentMethodLabel } from "@/components/staff/status-copy";

type ManualMethod = "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER";
type PendingOrder = { id: string; number: number; customerName: string | null; totalCents: number; version: number; table: { label: string } | null; createdAt: string; payments: { method: ManualMethod; status: string }[] };
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
  async function reject(order: PendingOrder) { const reason = window.prompt("¿Por qué rechazás este pago?")?.trim(); if (!reason) return; const response = await fetch(`/api/staff/orders/${order.id}/reject-payment`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason, expectedOrderVersion: order.version }) }); if (!response.ok) { setMessage("No se pudo rechazar el pago. Actualizá la pantalla."); return; } setMessage(`Pedido #${order.number} rechazado.`); await refresh(); }
  return <StaffShell title="Pagos pendientes" section="payments"><section className="staff-panel"><div className="panel-heading"><div><p className="eyebrow">Caja</p><h2>Confirmá los cobros</h2></div><button className="button-secondary" type="button" onClick={() => void refresh()}>Actualizar</button></div>{message && <p className="staff-message" role="status">{message}</p>}{orders.length === 0 ? <p className="empty-state">No hay pagos esperando confirmación.</p> : <div className="payment-list">{orders.map((order) => { const method = order.payments.find((payment) => payment.status === "UNPAID")?.method; return <article className="payment-card" key={order.id}><div><strong>Pedido #{order.number}</strong><span>{order.table?.label ?? "Sin mesa"} · {order.customerName ?? "Cliente QR"}</span><small>{method ? paymentMethodLabel(method) : "Pago manual"} · {new Date(order.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></div><strong>{ars(order.totalCents)}</strong><div className="button-row"><button className="primary-link" type="button" onClick={() => void confirm(order)}>{method === "BANK_TRANSFER" ? "Confirmar transferencia" : method === "CARD_AT_COUNTER" ? "Confirmar tarjeta" : "Confirmar efectivo"}</button><button className="button-text danger-text" type="button" onClick={() => void reject(order)}>Rechazar</button></div></article>; })}</div>}</section></StaffShell>;
}
