"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Order = { id: string; number: number; customerName: string | null; origin: string; status: string; totalCents: number; table: { label: string } | null };
export default function CounterPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => { void fetch("/api/staff/orders", { cache: "no-store" }).then(async (response) => { if (response.status === 401) { router.push("/staff/login"); return; } if (response.ok) setOrders(await response.json() as Order[]); }); }, [router]);
  return <main className="staff-page"><header className="staff-header"><div><p className="eyebrow">Operación</p><h1>Pedidos</h1></div><a className="secondary-button" href="/staff/payments">Pagos pendientes</a></header><section className="staff-panel"><div className="panel-heading"><h2>Últimos pedidos</h2></div>{orders.length === 0 ? <p className="empty-state">Todavía no hay pedidos.</p> : <div className="payment-list">{orders.map((order) => <article className="payment-card" key={order.id}><div><strong>Pedido #{order.number}</strong><span>{order.origin === "COUNTER" ? "Caja" : "QR"} · {order.table?.label ?? "Sin mesa"}</span><small>{order.customerName ?? "Cliente QR"}</small></div><strong>{order.status}</strong></article>)}</div>}</section></main>;
}
