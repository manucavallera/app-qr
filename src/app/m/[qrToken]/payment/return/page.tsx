"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PaymentReturnPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          router.push(`/m/${encodeURIComponent(qrToken)}`);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [qrToken, router]);

  return (
    <main className="cm-welcome-shell">
      <section className="cm-welcome">
        <h1>{status === "failure" ? "El pago no se completó" : status === "success" ? "Pago recibido" : "Verificando tu pago"}</h1>
        <p>{status === "failure" ? "Podés volver al seguimiento y elegir otro medio de pago." : "El bar va a confirmar el estado automáticamente cuando reciba la actualización."}</p>
        <div className="cm-state" role="status" aria-live="polite">
          <CircleNotch className="cm-spin" size={20} weight="bold" aria-hidden="true" />
          Volviendo a la carta en {countdown}…
        </div>
        <button className="cm-btn" type="button" onClick={() => router.push(`/m/${encodeURIComponent(qrToken)}`)}>
          Volver ahora
        </button>
      </section>
    </main>
  );
}
