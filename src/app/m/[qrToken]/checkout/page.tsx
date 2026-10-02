"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatArs as ars } from "@/lib/format";
import { CustomerShell } from "@/components/customer/customer-shell";
import { cartTotal, clearCart, loadCart, type CartItem } from "@/modules/orders/cart-store";

type PaymentMethod = "MERCADO_PAGO" | "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER";
type TransferDetails = { alias: string | null; cbuCvu: string | null; accountHolder: string | null; instructions: string | null };
type MenuProduct = { id: string; name: string; optionGroups: { values: { id: string; name: string }[] }[] };
type UnavailableMethod = { method: PaymentMethod; reason: string };
type MenuPayment = { methods: PaymentMethod[]; unavailable: UnavailableMethod[]; transfer: TransferDetails | null };
type PaymentStatus = "loading" | "ready" | "error";
const paymentLabels: Record<PaymentMethod, string> = { MERCADO_PAGO: "Mercado Pago", CASH: "Efectivo en caja", CARD_AT_COUNTER: "Tarjeta en caja", BANK_TRANSFER: "Transferencia bancaria" };

export default function CheckoutPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [payment, setPayment] = useState<MenuPayment>({ methods: [], unavailable: [], transfer: null });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("loading");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const total = useMemo(() => cartTotal(cart), [cart]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const loadPayment = useCallback(async () => {
    try {
      const response = await fetch(`/api/public/menu/${encodeURIComponent(qrToken)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("PAYMENT_LOAD_FAILED");
      const body = await response.json() as { categories?: { products?: MenuProduct[] }[]; payment?: MenuPayment };
      const nextPayment: MenuPayment = {
        methods: (body.payment?.methods ?? []) as PaymentMethod[],
        unavailable: (body.payment?.unavailable ?? []) as UnavailableMethod[],
        transfer: body.payment?.transfer ?? null,
      };
      setProducts(body.categories?.flatMap((category) => category.products ?? []) ?? []);
      setPayment(nextPayment);
      setPaymentMethod((current) => current && nextPayment.methods.includes(current) ? current : nextPayment.methods[0] ?? null);
      setPaymentStatus("ready");
    } catch {
      setPaymentStatus("error");
    }
  }, [qrToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(loadCart(qrToken));
    const timer = window.setTimeout(() => { void loadPayment(); }, 0);
    return () => window.clearTimeout(timer);
  }, [qrToken, loadPayment]);

  async function copyTransferDetails() {
    const transfer = payment.transfer;
    if (!transfer) return;
    const text = [transfer.alias && `Alias: ${transfer.alias}`, transfer.cbuCvu && `CBU/CVU: ${transfer.cbuCvu}`, transfer.accountHolder && `Titular: ${transfer.accountHolder}`].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setMessage("No pudimos copiar los datos. Seleccionalos manualmente."); }
  }

  async function submit() {
    if (paymentStatus !== "ready" || cart.length === 0 || !paymentMethod || !payment.methods.includes(paymentMethod)) return;
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
      const body = await response.json() as { id?: string; error?: string; quote?: { totalCents: number }; productName?: string; available?: number };
      if (!response.ok) {
        setMessage(body.error === "INSUFFICIENT_STOCK" ? `${body.available ? `Solo quedan ${body.available} de ${body.productName ?? "un producto"}` : `Se agotó ${body.productName ?? "un producto"}`}. Volvé a la carta y ajustá tu pedido.` : body.error === "PRICE_CHANGED" && body.quote ? `El total actualizado es ${ars(body.quote.totalCents)}. Volvé a la carta y revisá tu selección.` : "No pudimos enviar el pedido. Revisá la carta e intentá de nuevo.");
        return;
      }
      if (!body.id) return;
      clearCart(qrToken);
      if (paymentMethod === "MERCADO_PAGO") {
        const paymentResponse = await fetch(`/api/public/orders/${encodeURIComponent(body.id)}/mercado-pago`, { method: "POST" });
        const paymentBody = await paymentResponse.json() as { checkoutUrl?: string };
        if (!paymentResponse.ok || !paymentBody.checkoutUrl) {
          router.push(`/m/${encodeURIComponent(qrToken)}/orders/${body.id}`);
          return;
        }
        window.location.assign(paymentBody.checkoutUrl);
        return;
      }
      router.push(`/m/${encodeURIComponent(qrToken)}/orders/${body.id}`);
    } catch {
      setMessage("No pudimos conectar con el bar. Intentá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <CustomerShell eyebrow="Paso 3 de 4" title="Forma de pago" backHref={`/m/${encodeURIComponent(qrToken)}`}>
      <ol className="checkout-steps" aria-label="Progreso del pedido"><li className="is-done">Carta</li><li className="is-done">Tu pedido</li><li className="is-current">Forma de pago</li><li>Seguimiento</li></ol>
      {cart.length === 0 ? <p className="customer-empty">Tu selección está vacía. Volvé a la carta para agregar productos.</p> : <>
        <ul className="cart-lines">{cart.map((item, index) => { const product = productMap.get(item.productId); const optionNames = product?.optionGroups.flatMap((group) => group.values).filter((value) => item.optionIds.includes(value.id)).map((value) => value.name) ?? []; return <li key={`${item.productId}-${index}`}><div><strong>{item.quantity} × {product?.name ?? "Producto"}</strong>{optionNames.map((name) => <span className="cart-line-detail" key={name}>{name}</span>)}{item.notes && <span className="cart-line-detail">Nota: {item.notes}</span>}</div><strong>{ars(item.displayedTotalCents * item.quantity)}</strong></li>; })}</ul>
        <div className="cart-total"><span>Total</span><strong>{ars(total)}</strong></div>
        {paymentStatus === "loading" && <div className="payment-load-state" role="status"><span className="menu-loader" aria-hidden="true" />Cargando medios de pago…</div>}
        {paymentStatus === "error" && <div className="payment-load-error" role="alert"><strong>No pudimos cargar los medios de pago</strong><button className="button-secondary" type="button" onClick={() => { setMessage(null); setPaymentStatus("loading"); void loadPayment(); }}>Reintentar</button></div>}
        {paymentStatus === "ready" && payment.methods.length === 0 && payment.unavailable.length === 0 && <p className="payment-load-error" role="alert">El local no tiene medios de pago disponibles en este momento.</p>}
        {paymentStatus === "ready" && (payment.methods.length > 0 || payment.unavailable.length > 0) && (
          <fieldset className="payment-methods">
            <legend>Elegí cómo pagar</legend>
            {payment.methods.map((method) => (
              <label className={`payment-choice${paymentMethod === method ? " selected" : ""}`} key={method}>
                <input aria-label={paymentLabels[method]} type="radio" name="payment" checked={paymentMethod === method} onChange={() => { setPaymentMethod(method); setCopied(false); }} />
                <span>
                  <strong>{paymentLabels[method]}</strong>
                  <small>{method === "MERCADO_PAGO" ? "Pagás online y volvés al seguimiento." : method === "BANK_TRANSFER" ? "Transferís y Caja confirma el pedido." : "Se confirma en Caja."}</small>
                </span>
              </label>
            ))}
            {payment.unavailable.map(({ method, reason }) => (
              <div className="payment-choice payment-choice-disabled" key={method} aria-disabled="true">
                <span className="payment-choice-unavailable-icon" aria-hidden="true">—</span>
                <span>
                  <strong>{paymentLabels[method]}</strong>
                  <small>{reason}</small>
                </span>
              </div>
            ))}
          </fieldset>
        )}
        {paymentStatus === "ready" && paymentMethod === "BANK_TRANSFER" && payment.transfer && <aside className="transfer-instructions"><div><strong>Datos para transferir</strong><span>{payment.transfer.alias && `Alias: ${payment.transfer.alias}`}</span><span>{payment.transfer.cbuCvu && `CBU/CVU: ${payment.transfer.cbuCvu}`}</span><span>{payment.transfer.accountHolder && `Titular: ${payment.transfer.accountHolder}`}</span>{payment.transfer.instructions && <small>{payment.transfer.instructions}</small>}</div><button className="button-secondary" type="button" onClick={() => void copyTransferDetails()}>{copied ? "Datos copiados" : "Copiar datos"}</button></aside>}
        {message && <p className="login-error" role="alert">{message}</p>}
        <button className="primary-link customer-primary-action" type="button" disabled={sending || paymentStatus !== "ready" || !paymentMethod || !payment.methods.includes(paymentMethod)} onClick={() => void submit()}>{sending ? "Procesando…" : paymentMethod === "MERCADO_PAGO" ? "Ir a Mercado Pago" : "Enviar pedido"}</button>
      </>}
    </CustomerShell>
  );
}
