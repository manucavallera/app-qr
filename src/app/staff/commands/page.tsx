"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Command = { id: string; number: number; status: string; version: number; customerName: string | null; table: { label: string } | null; items: { id: string; productName: string; quantity: number; station: string; status: string; options: { valueName: string }[] }[] };
const next: Record<string, string> = { CONFIRMED: "PREPARING", PREPARING: "READY", READY: "DELIVERED" };
export default function CommandsPage() {
  const router = useRouter();
  const [commands, setCommands] = useState<Command[]>([]);
  const [station, setStation] = useState("GENERAL");
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => { const response = await fetch(`/api/staff/commands?station=${station}`, { cache: "no-store" }); if (response.status === 401) { router.push("/staff/login"); return; } if (response.ok) setCommands(await response.json() as Command[]); }, [router, station]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  async function advance(order: Command) { const targetStatus = next[order.status]; if (!targetStatus) return; const response = await fetch(`/api/staff/orders/${order.id}/transition`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetStatus, expectedVersion: order.version }) }); if (!response.ok) setMessage("El pedido cambió; actualizá la pantalla."); else await refresh(); }
  return <main className="staff-page"><header className="staff-header"><div><p className="eyebrow">Operación</p><h1>Comandas</h1></div><select className="form-input" value={station} onChange={(event) => setStation(event.target.value)}><option value="GENERAL">General</option><option value="KITCHEN">Cocina</option><option value="BAR">Barra</option></select></header>{message && <p className="login-error">{message}</p>}<section className="command-grid">{commands.length === 0 ? <p className="empty-state">No hay pedidos para preparar.</p> : commands.map((order) => <article className="command-card" key={order.id}><div className="command-card-heading"><strong>#{order.number}</strong><span>{order.table?.label ?? "Sin mesa"} · {order.customerName ?? "Cliente QR"}</span></div><ul>{order.items.filter((item) => station === "GENERAL" || item.station === station).map((item) => <li key={item.id}><strong>{item.quantity} × {item.productName}</strong>{item.options.map((option) => <small key={option.valueName}>{option.valueName}</small>)}</li>)}</ul><button className="primary-link" type="button" onClick={() => void advance(order)}>{next[order.status] ?? order.status}</button></article>)}</section></main>;
}
