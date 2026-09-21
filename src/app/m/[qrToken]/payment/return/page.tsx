"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PaymentReturnPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const router = useRouter();
  useEffect(() => {
    const timer = window.setTimeout(() => router.push(`/m/${encodeURIComponent(qrToken)}`), 3500);
    return () => window.clearTimeout(timer);
  }, [qrToken, router]);
  return <main className="qr-welcome-shell"><section className="qr-welcome-card"><p className="eyebrow">Pago recibido</p><h1>Estamos verificando tu pago</h1><p>El bar va a confirmar el estado con Mercado Pago. Podés volver a la carta mientras tanto.</p><button className="primary-link" type="button" onClick={() => router.push(`/m/${encodeURIComponent(qrToken)}`)}>Volver a la carta</button></section></main>;
}
