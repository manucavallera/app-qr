"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function PaymentReturnPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  useEffect(() => {
    const timer = window.setTimeout(() => router.push(`/m/${encodeURIComponent(qrToken)}`), 3500);
    return () => window.clearTimeout(timer);
  }, [qrToken, router]);
  return <main className="qr-welcome-shell"><section className="qr-welcome-card"><p className="eyebrow">Mercado Pago</p><h1>{status === "failure" ? "El pago no se completó" : status === "success" ? "Pago recibido" : "Estamos verificando tu pago"}</h1><p>{status === "failure" ? "Podés volver al seguimiento y elegir otro medio de pago." : "El bar va a confirmar el estado automáticamente cuando reciba la actualización."}</p><button className="primary-link" type="button" onClick={() => router.push(`/m/${encodeURIComponent(qrToken)}`)}>Volver a la carta</button></section></main>;
}
