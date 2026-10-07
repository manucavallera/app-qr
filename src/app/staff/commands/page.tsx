"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/staff/staff-shell";
import { fulfillmentLabel, orderStatusLabel } from "@/components/staff/status-copy";

type Command = { id: string; number: number; status: string; version: number; customerName: string | null; table: { label: string } | null; items: { id: string; productName: string; quantity: number; station: string; fulfillment: string; status: string; notes: string | null; options: { groupName: string; valueName: string }[] }[] };
const next: Record<string, string> = { CONFIRMED: "PREPARING", PREPARING: "READY", READY: "DELIVERED" };
export default function CommandsPage() {
  const router = useRouter();
  const [commands, setCommands] = useState<Command[]>([]);
  const [station, setStation] = useState("GENERAL");
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/staff/commands?station=${station}`, { cache: "no-store" });
    if (response.status === 401) { router.push("/staff/login"); return; }
    if (response.ok) setCommands(await response.json() as Command[]);
  }, [router, station]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => { void refresh(); }, 0);
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => { window.clearTimeout(initialRefresh); window.clearInterval(timer); };
  }, [refresh]);
  async function advance(order: Command) { const targetStatus = next[order.status]; if (!targetStatus) return; const response = await fetch(`/api/staff/orders/${order.id}/transition`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetStatus, expectedVersion: order.version }) }); if (!response.ok) setMessage("El pedido cambió; actualizá la pantalla."); else await refresh(); }
  return <StaffShell title="Cocina y barra" section="commands"><section className="staff-panel"><div className="panel-heading"><div><p className="eyebrow">Preparación</p><h2>Pedidos autorizados</h2></div><select className="form-input" aria-label="Filtrar estación" value={station} onChange={(event) => setStation(event.target.value)}><option value="GENERAL">General</option><option value="KITCHEN">Cocina</option><option value="BAR">Barra</option></select></div>{message && <p className="staff-message" role="status">{message}</p>}<section className="command-grid">{commands.length === 0 ? <p className="empty-state">No hay pedidos para preparar.</p> : commands.map((order) => <article className="command-card" key={order.id}><div className="command-card-heading"><strong>Pedido #{order.number}</strong><span>{order.table?.label ?? "Sin mesa"} · {order.customerName ?? "Cliente QR"}</span></div><ul>{order.items.filter((item) => station === "GENERAL" || item.station === station).map((item) => <li key={item.id}><strong>{item.quantity} × {item.productName}</strong><small>{fulfillmentLabel[item.fulfillment] ?? item.fulfillment}</small>{item.options.map((option) => <small key={option.valueName}>{option.groupName}: {option.valueName}</small>)}{item.notes && <small className="command-note">Nota: {item.notes}</small>}</li>)}</ul><p className="muted">{orderStatusLabel[order.status] ?? order.status}</p><button className="primary-link" type="button" onClick={() => void advance(order)}>{next[order.status] === "PREPARING" ? "Comenzar preparación" : next[order.status] === "READY" ? "Marcar como listo" : next[order.status] === "DELIVERED" ? "Marcar como entregado" : orderStatusLabel[order.status] ?? order.status}</button></article>)}</section></section></StaffShell>;
}
