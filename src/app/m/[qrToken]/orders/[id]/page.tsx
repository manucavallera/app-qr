"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { OrderProgress } from "@/components/customer/order-progress";
import { useSseResource } from "@/lib/client/use-sse-resource";
import { selectCurrentPayment } from "@/modules/payments/payment-selection";

type PaymentMethod = "MERCADO_PAGO" | "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER";
type Order = { number: number; status: string; totalCents: number; table: { label: string } | null; items: { productName: string; quantity: number; lineTotalCents: number; fulfillment: "TABLE" | "PICKUP" }[]; payments: { method: PaymentMethod; status: string }[] };
type TransferDetails = { alias: string | null; cbuCvu: string | null; accountHolder: string | null; instructions: string | null };
type PublicPayment = { transfer: TransferDetails | null };
const methodLabels: Record<PaymentMethod, string> = { MERCADO_PAGO: "Mercado Pago", CASH: "Efectivo en caja", CARD_AT_COUNTER: "Tarjeta en caja", BANK_TRANSFER: "Transferencia bancaria" };

function ars(cents: number): string { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100); }

export default function CustomerOrderPage() {
  const { id, qrToken } = useParams<{ id: string; qrToken: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<PublicPayment>({ transfer: null });
  const [error, setError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/public/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!response.ok) { setError("No pudimos encontrar este pedido."); return; }
    setOrder(await response.json() as Order);
    setError(null);
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    void fetch(`/api/public/menu/${encodeURIComponent(qrToken)}`, { cache: "no-store" }).then(async (response) => {
      if (response.ok) setPayment((await response.json() as { payment?: PublicPayment }).payment ?? { transfer: null });
    });
  }, [qrToken]);
  useSseResource(`/api/public/orders/${encodeURIComponent(id)}/events`, refresh);

  const currentPayment = order ? selectCurrentPayment(order.payments) : undefined;
  const isPickup = useMemo(() => Boolean(order?.items.length && order.items.every((item) => item.fulfillment === "PICKUP")), [order]);
  const readyNotice = order?.status === "READY";

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
    {readyNotice && <aside className="service-mode-note" role="status">¡Tu pedido está listo! {isPickup ? "Acercate a retirarlo en la barra." : order.table ? `Te lo llevamos a ${order.table.label}.` : "Acercate a retirarlo."}</aside>}
    <p className="customer-description">{order.status === "AWAITING_PAYMENT" ? "Completá el pago o esperá la confirmación de Caja." : order.status === "DELIVERED" ? "Este pedido ya terminó su recorrido." : "Te avisamos acá cuando cambie el estado."}</p>
    {order.status === "AWAITING_PAYMENT" && (currentPayment?.method === "CASH" || currentPayment?.method === "CARD_AT_COUNTER") && currentPayment.status !== "APPROVED" && (
      <aside className="service-mode-note" role="status">
        {currentPayment.method === "CASH" ? "💵 Acercate a la caja a pagar en efectivo para que confirmen tu pedido." : "💳 Acercate a la caja a pagar con tarjeta para que confirmen tu pedido."}
      </aside>
    )}
    {order.status === "DELIVERED" && <aside className="order-complete-note" role="status"><span aria-hidden="true">✓</span><div><strong>Pedido entregado</strong><p>Esperamos que lo disfrutes. ¡Gracias por elegirnos!</p></div></aside>}
    {order.status !== "CANCELLED" && <OrderProgress currentStatus={order.status} />}
    <section className="order-payment-panel"><strong>Pago: {currentPayment ? methodLabels[currentPayment.method] : "Pendiente"}</strong><span>{currentPayment?.status === "APPROVED" ? "Confirmado" : currentPayment?.status === "REJECTED" ? "Rechazado" : "Pendiente de confirmación"}</span>{currentPayment?.method === "MERCADO_PAGO" && currentPayment.status !== "APPROVED" && order.status === "AWAITING_PAYMENT" && <button className="primary-link" disabled={paymentLoading} onClick={() => void payWithMercadoPago()} type="button">{paymentLoading ? "Preparando pago…" : "Pagar con Mercado Pago"}</button>}{currentPayment?.method === "BANK_TRANSFER" && currentPayment.status !== "APPROVED" && payment.transfer && <div className="transfer-instructions"><strong>Transferí a {payment.transfer.alias ?? payment.transfer.cbuCvu}</strong><span>{payment.transfer.accountHolder && `Titular: ${payment.transfer.accountHolder}`}</span>{payment.transfer.instructions && <small>{payment.transfer.instructions}</small>}</div>}</section>
    <ul className="cart-lines">{order.items.map((item, index) => <li key={`${item.productName}-${index}`}><span>{item.quantity} × {item.productName}</span><strong>{ars(item.lineTotalCents)}</strong></li>)}</ul>
    <div className="cart-total"><span>Total</span><strong>{ars(order.totalCents)}</strong></div>
  </CustomerShell>;
}
