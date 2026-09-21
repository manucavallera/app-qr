"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cartTotal, loadCart, type CartItem } from "@/modules/orders/cart-store";

function ars(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100);
}

export default function CheckoutPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const total = useMemo(() => cartTotal(cart), [cart]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(loadCart(qrToken));
  }, [qrToken]);

  async function submit() {
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientRequestId: crypto.randomUUID(),
          expectedTotalCents: total,
          paymentMethod,
          items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, optionValueIds: item.optionIds, notes: item.notes || undefined })),
        }),
      });
      const body = await response.json() as { id?: string; error?: string; quote?: { totalCents: number } };
      if (!response.ok) {
        setMessage(body.error === "PRICE_CHANGED" && body.quote ? `El total actualizado es ${ars(body.quote.totalCents)}. Volvé a la carta y revisá tu selección.` : "No pudimos enviar el pedido. Revisá la carta e intentá de nuevo.");
        return;
      }
      if (body.id) router.push(`/m/${encodeURIComponent(qrToken)}/orders/${body.id}`);
    } catch {
      setMessage("No pudimos conectar con el bar. Intentá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="qr-welcome-shell">
      <section className="qr-welcome-card">
        <p className="eyebrow">Confirmá tu pedido</p>
        <h1>Enviar a la mesa</h1>
        {cart.length === 0 ? <p>Tu selección está vacía. Volvé a la carta para agregar productos.</p> : <>
          <ul className="cart-lines">{cart.map((item, index) => <li key={`${item.productId}-${index}`}><span>{item.quantity} × producto</span><strong>{ars(item.displayedTotalCents * item.quantity)}</strong></li>)}</ul>
          <div className="cart-total"><span>Total</span><strong>{ars(total)}</strong></div>
          <fieldset className="dialog-option-group" style={{ marginTop: 20 }}>
            <legend>¿Cómo pagás?</legend>
            <label className="dialog-option"><input type="radio" name="payment" checked={paymentMethod === "CASH"} onChange={() => setPaymentMethod("CASH")} /> Efectivo en caja</label>
            <label className="dialog-option"><input type="radio" name="payment" checked={paymentMethod === "CARD_AT_COUNTER"} onChange={() => setPaymentMethod("CARD_AT_COUNTER")} /> Tarjeta en caja</label>
          </fieldset>
          {message && <p className="login-error" role="alert">{message}</p>}
          <button className="primary-link login-button" type="button" disabled={sending} onClick={() => void submit()}>{sending ? "Enviando…" : "Enviar pedido"}</button>
        </>}
        <button className="secondary-button" type="button" onClick={() => router.push(`/m/${encodeURIComponent(qrToken)}`)}>Volver a la carta</button>
      </section>
    </main>
  );
}
