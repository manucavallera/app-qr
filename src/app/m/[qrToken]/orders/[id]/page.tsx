"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSseResource } from "@/lib/client/use-sse-resource";

type Order = { number: number; status: string; totalCents: number; table: { label: string } | null; items: { productName: string; quantity: number; lineTotalCents: number }[]; payments: { method: string; status: string }[] };

function ars(cents: number): string { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100); }
const labels: Record<string, string> = { AWAITING_PAYMENT: "Esperando confirmación de caja", CONFIRMED: "Pedido confirmado", PREPARING: "En preparación", READY: "Listo", DELIVERED: "Entregado", CANCELLED: "Cancelado" };

export default function CustomerOrderPage() {
  const { id, qrToken } = useParams<{ id: string; qrToken: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/public/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!response.ok) { setError("No pudimos encontrar este pedido."); return; }
    setOrder(await response.json() as Order);
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  useSseResource(`/api/public/orders/${encodeURIComponent(id)}/events`, refresh);
  const readyNotice = order?.status === "READY";

  if (error) return <main className="qr-welcome-shell"><section className="qr-welcome-card"><p className="login-error">{error}</p><button className="primary-link" type="button" onClick={() => router.push(`/m/${encodeURIComponent(qrToken)}`)}>Volver</button></section></main>;
  if (!order) return <main className="menu-loading">Cargando tu pedido…</main>;
  return <main className="qr-welcome-shell"><section className="qr-welcome-card">{readyNotice && <aside className="service-mode-note" role="status">¡Tu pedido está listo! Acercate a retirarlo o revisá la mesa.</aside>}<p className="eyebrow">Pedido #{order.number}</p><h1>{labels[order.status] ?? order.status}</h1><p>Te avisamos acá cuando cambie el estado.</p><ul className="cart-lines">{order.items.map((item, index) => <li key={`${item.productName}-${index}`}><span>{item.quantity} × {item.productName}</span><strong>{ars(item.lineTotalCents)}</strong></li>)}</ul><div className="cart-total"><span>Total</span><strong>{ars(order.totalCents)}</strong></div><button className="secondary-button" type="button" onClick={() => router.push(`/m/${encodeURIComponent(qrToken)}`)}>Volver a la carta</button></section></main>;
}
