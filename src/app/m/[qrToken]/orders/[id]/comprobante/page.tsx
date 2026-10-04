"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderReceipt, type ReceiptOrder } from "@/components/receipt/order-receipt";

export default function CustomerReceiptPage() {
  const { id, qrToken } = useParams<{ id: string; qrToken: string }>();
  const [order, setOrder] = useState<ReceiptOrder | null>(null);
  const [businessName, setBusinessName] = useState("Bar");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/public/orders/${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) { setError("No pudimos encontrar este pedido."); return; }
      setOrder(await response.json() as ReceiptOrder);
    }).catch(() => setError("No pudimos cargar el comprobante."));
    void fetch(`/api/public/menu/${encodeURIComponent(qrToken)}`, { cache: "no-store" }).then(async (response) => {
      if (response.ok) setBusinessName((await response.json() as { business?: { name?: string } }).business?.name ?? "Bar");
    }).catch(() => undefined);
  }, [id, qrToken]);

  const trackingHref = `/m/${encodeURIComponent(qrToken)}/orders/${encodeURIComponent(id)}`;
  return (
    <main className="receipt-page">
      <div className="receipt-actions">
        <a className="button-secondary" href={trackingHref}>Volver al pedido</a>
        <button className="primary-link" type="button" disabled={!order} onClick={() => window.print()}>Guardar o imprimir</button>
      </div>
      {error ? <p className="error-state" role="alert">{error}</p> : order ? <OrderReceipt order={order} businessName={businessName} /> : <p className="loading-state" role="status">Cargando comprobante…</p>}
    </main>
  );
}
