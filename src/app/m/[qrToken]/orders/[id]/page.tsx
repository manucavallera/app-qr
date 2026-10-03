"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { OrderProgress } from "@/components/customer/order-progress";
import { formatArs as ars } from "@/lib/format";
import { playReadyTone } from "@/lib/client/ready-alert";
import { useSseResource } from "@/lib/client/use-sse-resource";
import { selectCurrentPayment } from "@/modules/payments/payment-selection";

type PaymentMethod = "MERCADO_PAGO" | "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER";
type Order = { number: number; status: string; totalCents: number; table: { label: string } | null; items: { productName: string; quantity: number; lineTotalCents: number; fulfillment: "TABLE" | "PICKUP"; notes: string | null; options: { valueName: string }[] }[]; payments: { method: PaymentMethod; status: string }[] };
type TransferDetails = { alias: string | null; cbuCvu: string | null; accountHolder: string | null; instructions: string | null };
type PublicPayment = { transfer: TransferDetails | null };
const methodLabels: Record<PaymentMethod, string> = { MERCADO_PAGO: "Mercado Pago", CASH: "Efectivo en caja", CARD_AT_COUNTER: "Tarjeta en caja", BANK_TRANSFER: "Transferencia bancaria" };


export default function CustomerOrderPage() {
  const { id, qrToken } = useParams<{ id: string; qrToken: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<PublicPayment>({ transfer: null });
  const [error, setError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/public/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) { setError("No pudimos encontrar este pedido."); return; }
      setOrder(await response.json() as Order);
      setError(null);
    } catch {
      // Network blip: keep the last known order; SSE/fallback polling retries.
    }
  }, [id]);
  useEffect(() => {
    void fetch(`/api/public/menu/${encodeURIComponent(qrToken)}`, { cache: "no-store" }).then(async (response) => {
      if (response.ok) setPayment((await response.json() as { payment?: PublicPayment }).payment ?? { transfer: null });
    });
  }, [qrToken]);
  useSseResource(`/api/public/orders/${encodeURIComponent(id)}/events`, refresh);

  const currentPayment = order ? selectCurrentPayment(order.payments) : undefined;
  const isPickup = useMemo(() => Boolean(order?.items.length && order.items.every((item) => item.fulfillment === "PICKUP")), [order]);
  const readyNotice = order?.status === "READY";

  // Pager: vibrate and beep once when the order becomes ready while this page is open.
  const [soundOn, setSoundOn] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const previousStatus = useRef<string | null>(null);
  const status = order?.status ?? null;
  useEffect(() => {
    if (status === "READY" && previousStatus.current !== null && previousStatus.current !== "READY") {
      if ("vibrate" in navigator) navigator.vibrate([300, 150, 300, 150, 300]);
      playReadyTone(audioContext.current);
    }
    previousStatus.current = status;
  }, [status]);
  useEffect(() => () => { void audioContext.current?.close(); }, []);

  function toggleSound() {
    if (soundOn) {
      void audioContext.current?.close();
      audioContext.current = null;
      setSoundOn(false);
      return;
    }
    // Browsers only allow audio after a tap, so the context is created here.
    audioContext.current = new AudioContext();
    playReadyTone(audioContext.current);
    setSoundOn(true);
  }

  async function payWithMercadoPago() {
    setPaymentLoading(true);
    const response = await fetch(`/api/public/orders/${encodeURIComponent(id)}/mercado-pago`, { method: "POST" });
    const body = await response.json() as { checkoutUrl?: string };
    if (response.ok && body.checkoutUrl) window.location.assign(body.checkoutUrl);
    else setError("No pudimos preparar el pago online. Actualizá e intentá de nuevo.");
    setPaymentLoading(false);
  }

  if (error) return <CustomerShell eyebrow="Seguimiento" title="No pudimos cargar tu pedido" backHref={`/m/${encodeURIComponent(qrToken)}`}><p className="login-error" role="alert">{error}</p><button className="button-secondary customer-retry" type="button" onClick={() => void refresh()}>Reintentar</button></CustomerShell>;
  if (!order) return <main className="menu-loading" aria-live="polite"><span className="menu-loader" aria-hidden="true" />Cargando tu pedido…</main>;
  const title = order.status === "AWAITING_PAYMENT" ? "Pedido recibido" : order.status === "CANCELLED" ? "Pedido cancelado" : order.status === "READY" ? "¡Ya está listo!" : order.status === "DELIVERED" ? "¡Disfrutá tu pedido!" : "Seguimiento del pedido";
  return <CustomerShell eyebrow={`Pedido #${order.number}`} title={title} backHref={`/m/${encodeURIComponent(qrToken)}`}>
    {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
      <div className={`order-pager${readyNotice ? " is-ready" : ""}`}>
        <small>Tu número</small>
        <strong>{order.number}</strong>
        {!readyNotice && <button className="order-pager-sound" type="button" aria-pressed={soundOn} onClick={toggleSound}>{soundOn ? "Aviso sonoro activado" : "Avisarme con sonido"}</button>}
      </div>
    )}
    {readyNotice && <aside className="service-mode-note" role="status">¡Tu pedido está listo! {isPickup ? "Acercate a retirarlo en la barra." : order.table ? `Te lo llevamos a ${order.table.label}.` : "Acercate a retirarlo."}</aside>}
    <p className="customer-description">{order.status === "AWAITING_PAYMENT" ? "Completá el pago o esperá la confirmación de Caja." : order.status === "DELIVERED" ? "Este pedido ya terminó su recorrido." : order.status === "CANCELLED" ? "Este pedido se canceló. Podés volver a la carta y pedir de nuevo, o consultar en la caja." : "Te avisamos acá cuando cambie el estado."}</p>
    {order.status === "AWAITING_PAYMENT" && (currentPayment?.method === "CASH" || currentPayment?.method === "CARD_AT_COUNTER") && currentPayment.status !== "APPROVED" && (
      <aside className="service-mode-note" role="status">
        {currentPayment.method === "CASH" ? "💵 Acercate a la caja a pagar en efectivo para que confirmen tu pedido." : "💳 Acercate a la caja a pagar con tarjeta para que confirmen tu pedido."}
      </aside>
    )}
    {order.status === "DELIVERED" && <aside className="order-complete-note" role="status"><span aria-hidden="true">✓</span><div><strong>Pedido entregado</strong><p>Esperamos que lo disfrutes. ¡Gracias por elegirnos!</p></div></aside>}
    {order.status !== "CANCELLED" && <OrderProgress currentStatus={order.status} />}
    <section className="order-payment-panel"><strong>Pago: {currentPayment ? methodLabels[currentPayment.method] : "Pendiente"}</strong><span>{currentPayment?.status === "APPROVED" ? "Confirmado" : currentPayment?.status === "REJECTED" ? "Rechazado" : "Pendiente de confirmación"}</span>{currentPayment?.method === "MERCADO_PAGO" && currentPayment.status !== "APPROVED" && order.status === "AWAITING_PAYMENT" && <button className="primary-link" disabled={paymentLoading} onClick={() => void payWithMercadoPago()} type="button">{paymentLoading ? "Preparando pago…" : "Pagar con Mercado Pago"}</button>}{currentPayment?.method === "BANK_TRANSFER" && currentPayment.status !== "APPROVED" && payment.transfer && <div className="transfer-instructions"><strong>Transferí a {payment.transfer.alias ?? payment.transfer.cbuCvu}</strong><span>{payment.transfer.accountHolder && `Titular: ${payment.transfer.accountHolder}`}</span>{payment.transfer.instructions && <small>{payment.transfer.instructions}</small>}</div>}</section>
    <ul className="cart-lines">{order.items.map((item, index) => <li key={`${item.productName}-${index}`}><div><span>{item.quantity} × {item.productName}</span>{item.options.map((option) => <span className="cart-line-detail" key={option.valueName}>{option.valueName}</span>)}{item.notes && <span className="cart-line-detail">Nota: {item.notes}</span>}</div><strong>{ars(item.lineTotalCents)}</strong></li>)}</ul>
    <div className="cart-total"><span>Total</span><strong>{ars(order.totalCents)}</strong></div>
    {currentPayment?.status === "APPROVED" && <a className="button-secondary customer-order-more" href={`/m/${encodeURIComponent(qrToken)}/orders/${encodeURIComponent(id)}/comprobante`}>Ver comprobante</a>}
    <a className="button-secondary customer-order-more" href={`/m/${encodeURIComponent(qrToken)}`}>Pedir algo más</a>
  </CustomerShell>;
}
