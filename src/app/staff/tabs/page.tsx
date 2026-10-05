"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/staff/staff-shell";

type Method = "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER";
type Person = { key: string; customerSessionId: string | null; name: string; totalCents: number; orders: { number: number; items: { productName: string; quantity: number; lineTotalCents: number }[] }[] };
type OpenTab = { id: string; number: number; label: string; billRequestedAt: string | null; totalCents: number; people: Person[] };
const methods: { method: Method; label: string }[] = [{ method: "CASH", label: "Efectivo" }, { method: "CARD_AT_COUNTER", label: "Tarjeta" }, { method: "BANK_TRANSFER", label: "Transferencia / billetera" }];
function ars(cents: number): string { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100); }

export default function StaffTabsPage() {
  const router = useRouter();
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [method, setMethod] = useState<Method>("CASH");
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/staff/tabs", { cache: "no-store" });
    if (response.status === 401) { router.push("/staff/login"); return; }
    if (response.ok) setTabs(await response.json() as OpenTab[]);
  }, [router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function settle(tab: OpenTab, person?: Person) {
    const amount = person ? person.totalCents : tab.totalCents;
    const who = person ? `${person.name} (${tab.label})` : tab.label;
    if (!window.confirm(`¿Cobraste ${ars(amount)} de ${who}?`)) return;
    const response = await fetch("/api/staff/tabs/settle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tabId: tab.id, method, ...(person ? { personKey: person.key } : {}) }) });
    setMessage(response.ok ? `Cobrado: ${who}.` : "No se pudo cobrar. Actualizá la pantalla.");
    await refresh();
  }

  return <StaffShell title="Cuentas de mesa" section="tabs"><section className="staff-panel">
    <div className="panel-heading"><div><p className="eyebrow">Cobro al final</p><h2>Mesas con cuenta abierta</h2></div><button className="button-secondary" type="button" onClick={() => void refresh()}>Actualizar</button></div>
    <fieldset className="dialog-option-group"><legend>Medio de cobro</legend>{methods.map((item) => <label className="dialog-option" key={item.method}><input type="radio" name="tab-method" checked={method === item.method} onChange={() => setMethod(item.method)} /> {item.label}</label>)}</fieldset>
    {message && <p className="staff-message" role="status">{message}</p>}
    {tabs.length === 0 ? <p className="empty-state">No hay mesas con cuenta abierta.</p> : <div className="payment-list">{tabs.map((tab) => <article className="payment-card" key={tab.id}>
      <div><strong>{tab.label} · cuenta #{tab.number}{tab.billRequestedAt ? " · pidió la cuenta" : ""}</strong><small>{tab.people.length} {tab.people.length === 1 ? "persona" : "personas"}</small></div>
      <strong>{ars(tab.totalCents)}</strong>
      <ul>{tab.people.map((person) => <li key={person.key}>{person.name}: {ars(person.totalCents)} <small>({person.orders.flatMap((order) => order.items).map((item) => `${item.quantity} ${item.productName}`).join(", ")})</small>{tab.people.length > 1 && <button className="button-text" type="button" onClick={() => void settle(tab, person)}>Cobrar solo a {person.name}</button>}</li>)}</ul>
      <div className="button-row"><button className="primary-link" type="button" onClick={() => void settle(tab)}>Cobrar toda la mesa</button></div>
    </article>)}</div>}
  </section></StaffShell>;
}
