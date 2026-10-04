"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderReceipt, type ReceiptOrder } from "@/components/receipt/order-receipt";

export default function StaffReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ order: ReceiptOrder; businessName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/staff/orders/${encodeURIComponent(id)}/receipt`, { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { router.push("/staff/login"); return; }
      if (!response.ok) { setError("No encontramos ese pedido."); return; }
      setData(await response.json() as { order: ReceiptOrder; businessName: string });
    }).catch(() => setError("No se pudo cargar el comprobante."));
  }, [id, router]);

  return (
    <main className="receipt-page">
      <div className="receipt-actions">
        <a className="button-secondary" href="/staff/orders">Volver a Pedidos</a>
        <button className="primary-link" type="button" disabled={!data} onClick={() => window.print()}>Imprimir</button>
      </div>
      {error ? <p className="error-state" role="alert">{error}</p> : data ? <OrderReceipt order={data.order} businessName={data.businessName} /> : <p className="loading-state" role="status">Cargando comprobante…</p>}
    </main>
  );
}
