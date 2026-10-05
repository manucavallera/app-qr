"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { formatArs as ars } from "@/lib/format";

type TabOrder = { number: number; totalCents: number; items: { productName: string; quantity: number; lineTotalCents: number }[] };
type Tab = { tableLabel: string; billRequestedAt: string | null; mine: { totalCents: number; orders: TabOrder[] }; tableTotalCents: number };

export default function CustomerAccountPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [tab, setTab] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

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

  const back = `/m/${encodeURIComponent(qrToken)}`;
  if (error) return <CustomerShell eyebrow="Mi cuenta" title="No pudimos cargar tu cuenta" backHref={back}><p className="cm-error" role="alert">{error}</p><button className="cm-btn cm-btn-quiet" type="button" onClick={() => void refresh()}>Reintentar</button></CustomerShell>;
  if (!tab) return <main className="cm-page"><div className="cm-state" role="status" aria-live="polite"><CircleNotch className="cm-spin" size={20} weight="bold" aria-hidden="true" />Cargando tu cuenta…</div></main>;

  const empty = tab.mine.orders.length === 0;
  return <CustomerShell eyebrow={tab.tableLabel} title="Mi cuenta" backHref={back}>
    {tab.billRequestedAt && <aside className="cm-notice" role="status">Pediste la cuenta. En un momento se acerca el mozo, o podés pasar por la caja.</aside>}
    {empty ? <p className="cm-lead">Todavía no tenés nada sin pagar en esta mesa.</p> : <>
      <p className="cm-lead">Esto es lo que pediste vos y todavía no se pagó.</p>
      <ul className="cm-lines">{tab.mine.orders.flatMap((order) => order.items.map((item, index) => <li className="cm-line" key={`${order.number}-${index}`}><div className="cm-line-main"><span>{item.quantity} × {item.productName}</span><strong>{ars(item.lineTotalCents)}</strong></div><span className="cm-line-detail">Pedido #{order.number}</span></li>))}</ul>
      <div className="cm-total"><span>Tu parte</span><strong>{ars(tab.mine.totalCents)}</strong></div>
    </>}
    {tab.tableTotalCents > tab.mine.totalCents && <p className="cm-lead">Total de la mesa: {ars(tab.tableTotalCents)}</p>}
    {!tab.billRequestedAt && tab.tableTotalCents > 0 && <button className="cm-btn" type="button" disabled={requesting} onClick={() => void requestBill()}>{requesting ? "Pidiendo…" : "Pedir la cuenta"}</button>}
    <a className="cm-btn cm-btn-quiet" href={back}>Pedir algo más</a>
  </CustomerShell>;
}
