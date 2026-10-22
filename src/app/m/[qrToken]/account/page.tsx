"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { formatArs as ars } from "@/lib/format";

type TabOrder = { number: number; totalCents: number; items: { productName: string; quantity: number; lineTotalCents: number }[] };
type TabPerson = { name: string; isMe: boolean; totalCents: number; items: { productName: string; quantity: number; lineTotalCents: number; orderNumber: number }[] };
type Tab = { tableLabel: string; billRequestedAt: string | null; mine: { totalCents: number; orders: TabOrder[] }; people?: TabPerson[]; tableTotalCents: number; canPayOnline: boolean };

export default function CustomerAccountPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [tab, setTab] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState<"mine" | "table" | null>(null);
  const returned = useSearchParams().get("pago");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/public/tab", { cache: "no-store" });
      if (!response.ok) { setError("No pudimos cargar tu cuenta. Escaneá el QR de nuevo."); return; }
      setTab(await response.json() as Tab);
      setError(null);
    } catch {
      // Sin red: se conserva la última cuenta y se reintenta con el botón o al volver a abrir.
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function requestBill() {
    setRequesting(true);
    const response = await fetch("/api/public/tab/bill", { method: "POST" });
    if (!response.ok) setError("No pudimos pedir la cuenta. Intentá de nuevo o avisale al mozo.");
    await refresh();
    setRequesting(false);
  }

  async function payOnline(scope: "mine" | "table") {
    setPaying(scope);
    try {
      const response = await fetch("/api/public/tab/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope }) });
      const body = await response.json().catch(() => null) as { checkoutUrl?: string } | null;
      if (response.ok && body?.checkoutUrl) { window.location.assign(body.checkoutUrl); return; }
      setError(null);
      setPayError("No pudimos abrir el pago online. Probá de nuevo o pagá en caja o con el mozo.");
    } catch {
      setPayError("No pudimos abrir el pago online. Probá de nuevo o pagá en caja o con el mozo.");
    }
    setPaying(null);
  }

  const back = `/m/${encodeURIComponent(qrToken)}`;
  if (error) return <CustomerShell eyebrow="Mi cuenta" title="No pudimos cargar tu cuenta" backHref={back}><p className="cm-error" role="alert">{error}</p><button className="cm-btn cm-btn-quiet" type="button" onClick={() => void refresh()}>Reintentar</button></CustomerShell>;
  if (!tab) return <main className="cm-page"><div className="cm-state" role="status" aria-live="polite"><CircleNotch className="cm-spin" size={20} weight="bold" aria-hidden="true" />Cargando tu cuenta…</div></main>;

  const empty = tab.mine.orders.length === 0;
  // Primero lo tuyo, después el resto de la mesa en orden de llegada.
  const people = [...(tab.people ?? [])].sort((a, b) => Number(b.isMe) - Number(a.isMe));
  const others = people.some((person) => !person.isMe);
  return <CustomerShell eyebrow={tab.tableLabel} title="Mi cuenta" backHref={back}>
    {returned === "ok" && <aside className="cm-notice" role="status">Recibimos tu pago. En unos segundos tu cuenta se actualiza.</aside>}
    {returned === "pendiente" && <aside className="cm-notice" role="status">Tu pago está pendiente. Cuando se acredite, la cuenta se actualiza sola.</aside>}
    {returned === "error" && <p className="cm-error" role="alert">El pago no se completó. Podés intentar de nuevo o pagar en caja.</p>}
    {payError && <p className="cm-error" role="alert">{payError}</p>}
    {tab.billRequestedAt && <aside className="cm-notice" role="status">Pediste la cuenta. En un momento se acerca el mozo, o podés pasar por la caja.</aside>}
    {tab.tableTotalCents === 0 ? <p className="cm-lead">Todavía no hay nada sin pagar en esta mesa.</p> : <>
      <p className="cm-lead">{others ? "Todo lo que pidió la mesa y todavía no se pagó." : "Esto es lo que pediste y todavía no se pagó."}</p>
      {people.map((person, personIndex) => <section className="cm-tab-person" key={personIndex} aria-label={person.isMe ? "Lo tuyo" : `Lo de ${person.name}`}>
        {others && <div className="cm-tab-person-head"><strong>{person.isMe ? `Vos (${person.name})` : person.name}</strong><span>{ars(person.totalCents)}</span></div>}
        <ul className="cm-lines">{person.items.map((item, index) => <li className="cm-line" key={`${item.orderNumber}-${index}`}><div className="cm-line-main"><span>{item.quantity} × {item.productName}</span><strong>{ars(item.lineTotalCents)}</strong></div><span className="cm-line-detail">Pedido #{item.orderNumber}</span></li>)}</ul>
      </section>)}
      {!empty && others && <div className="cm-total"><span>Tu parte</span><strong>{ars(tab.mine.totalCents)}</strong></div>}
      <div className="cm-total"><span>Total de la mesa</span><strong>{ars(tab.tableTotalCents)}</strong></div>
    </>}
    {tab.canPayOnline && !empty && <button className="cm-btn" type="button" disabled={paying !== null} onClick={() => void payOnline("mine")}>{paying === "mine" ? "Abriendo Mercado Pago…" : `Pagar mi parte con Mercado Pago (${ars(tab.mine.totalCents)})`}</button>}
    {tab.canPayOnline && tab.tableTotalCents > tab.mine.totalCents && <button className="cm-btn cm-btn-quiet" type="button" disabled={paying !== null} onClick={() => void payOnline("table")}>{paying === "table" ? "Abriendo Mercado Pago…" : `Pagar toda la mesa con Mercado Pago (${ars(tab.tableTotalCents)})`}</button>}
    {!tab.billRequestedAt && tab.tableTotalCents > 0 && <button className={tab.canPayOnline && !empty ? "cm-btn cm-btn-quiet" : "cm-btn"} type="button" disabled={requesting} onClick={() => void requestBill()}>{requesting ? "Pidiendo…" : "Pedir la cuenta"}</button>}
    <a className="cm-btn cm-btn-quiet" href={back}>Pedir algo más</a>
  </CustomerShell>;
}
