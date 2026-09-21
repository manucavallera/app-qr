"use client";

import { useRouter } from "next/navigation";

export default function PaymentReturnPage() {
  const router = useRouter();
  return <main className="qr-welcome-shell"><section className="qr-welcome-card"><p className="eyebrow">Pago recibido</p><h1>Estamos verificando tu pago</h1><p>Mercado Pago está confirmando el estado. El pedido se actualiza automáticamente cuando el bar recibe el webhook.</p><button className="primary-link" type="button" onClick={() => router.push("/")}>Volver</button></section></main>;
}
