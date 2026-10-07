"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/staff/staff-shell";

type Method = "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER";
type Person = { key: string; customerSessionId: string | null; name: string; totalCents: number; orders: { number: number; items: { productName: string; quantity: number; lineTotalCents: number }[] }[] };
type OpenTab = { id: string; number: number; label: string; billRequestedAt: string | null; totalCents: number; people: Person[] };
const methods: { method: Method; label: string; paid: string }[] = [{ method: "CASH", label: "Efectivo", paid: "en efectivo" }, { method: "CARD_AT_COUNTER", label: "Tarjeta", paid: "con tarjeta" }, { method: "BANK_TRANSFER", label: "Transferencia / billetera", paid: "por transferencia" }];
function ars(cents: number): string { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100); }

export default function StaffTabsPage() {
  const router = useRouter();
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  // The charge being confirmed. The method is asked here, on every charge, so none is ever assumed.
  const [charging, setCharging] = useState<{ tab: OpenTab; person?: Person } | null>(null);
  const [saving, setSaving] = useState(false);
  const chargeDialog = useRef<HTMLDialogElement>(null);
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

  function askCharge(tab: OpenTab, person?: Person) {
    setCharging({ tab, person });
    chargeDialog.current?.showModal();
  }

  async function settle(method: (typeof methods)[number]) {
    if (!charging || saving) return;
    const { tab, person } = charging;
    const who = person ? `${person.name} (${tab.label})` : tab.label;
    const amount = person ? person.totalCents : tab.totalCents;
    setSaving(true);
    try {
      const response = await fetch("/api/staff/tabs/settle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tabId: tab.id, method: method.method, ...(person ? { personKey: person.key } : {}) }) });
      setMessage(response.ok ? `Cobrado ${method.paid}: ${who}, ${ars(amount)}.` : "No se pudo cobrar. Actualizá la pantalla.");
    } catch {
      setMessage("No se pudo cobrar. Revisá la conexión.");
    } finally {
      setSaving(false);
      chargeDialog.current?.close();
      await refresh();
    }
  }

  const chargeWho = charging ? (charging.person ? `${charging.person.name} · ${charging.tab.label}` : `Toda la mesa · ${charging.tab.label}`) : "";
  const chargeAmount = charging ? (charging.person ? charging.person.totalCents : charging.tab.totalCents) : 0;

  return <StaffShell title="Mesas por cobrar" section="tabs"><section className="staff-panel">
    <div className="panel-heading"><div><p className="eyebrow">Cobro al final</p><h2>Mesas con cuenta abierta</h2></div><button className="button-secondary" type="button" onClick={() => void refresh()}>Actualizar</button></div>
    {message && <p className="staff-message" role="status">{message}</p>}
    {tabs.length === 0 ? <p className="empty-state">No hay mesas con cuenta abierta.</p> : <div className="payment-list">{tabs.map((tab) => <article className="payment-card" key={tab.id}>
      <div><strong>{tab.label} · cuenta #{tab.number}{tab.billRequestedAt ? " · pidió la cuenta" : ""}</strong><small>{tab.people.length} {tab.people.length === 1 ? "persona" : "personas"}</small></div>
      <strong>{ars(tab.totalCents)}</strong>
      <ul className="tab-people">{tab.people.map((person) => <li key={person.key}>
        <div><strong>{person.name}</strong><small>{person.orders.flatMap((order) => order.items).map((item) => `${item.quantity} ${item.productName}`).join(", ")}</small></div>
        <span>{ars(person.totalCents)}</span>
        {tab.people.length > 1 && <button className="button-secondary" type="button" onClick={() => askCharge(tab, person)}>Cobrar a {person.name}</button>}
      </li>)}</ul>
      <div className="button-row"><button className="primary-link" type="button" onClick={() => askCharge(tab)}>Cobrar toda la mesa</button><a className="button-secondary" href={`/staff/tabs/${encodeURIComponent(tab.id)}/comprobante`}>Imprimir cuenta</a></div>
    </article>)}</div>}
  </section>
    <dialog ref={chargeDialog} className="staff-panel charge-dialog" aria-labelledby="charge-title" onClose={() => setCharging(null)}>
      <p className="eyebrow">{chargeWho}</p>
      <h2 id="charge-title">¿Cómo pagó {ars(chargeAmount)}?</h2>
      <div className="charge-methods">{methods.map((item) => <button className="primary-link" key={item.method} type="button" disabled={saving} onClick={() => void settle(item)}>{item.label}</button>)}</div>
      <button className="button-secondary" type="button" disabled={saving} onClick={() => chargeDialog.current?.close()}>Volver sin cobrar</button>
    </dialog>
  </StaffShell>;
}
