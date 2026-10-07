"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TabReceipt, type ReceiptTab } from "@/components/receipt/tab-receipt";

export default function StaffTabReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ tab: ReceiptTab; businessName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/staff/tabs/${encodeURIComponent(id)}/receipt`, { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { router.push("/staff/login"); return; }
      if (!response.ok) { setError("Esa cuenta ya no tiene nada por cobrar."); return; }
      setData(await response.json() as { tab: ReceiptTab; businessName: string });
    }).catch(() => setError("No se pudo cargar la cuenta."));
  }, [id, router]);

  return (
    <main className="receipt-page">
      <div className="receipt-actions">
        <a className="button-secondary" href="/staff/tabs">Volver a Mesas por cobrar</a>
        <button className="primary-link" type="button" disabled={!data} onClick={() => window.print()}>Imprimir</button>
      </div>
      {error ? <p className="error-state" role="alert">{error}</p> : data ? <TabReceipt tab={data.tab} businessName={data.businessName} /> : <p className="loading-state" role="status">Cargando cuenta…</p>}
    </main>
  );
}
