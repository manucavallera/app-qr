"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cartTotal, loadCart, type CartItem } from "@/modules/orders/cart-store";

type PaymentMethod = "MERCADO_PAGO" | "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER";
type TransferDetails = { alias: string | null; cbuCvu: string | null; accountHolder: string | null; instructions: string | null };
type MenuProduct = { id: string; name: string; optionGroups: { values: { id: string; name: string }[] }[] };
type MenuPayment = { methods: PaymentMethod[]; transfer: TransferDetails | null };
const paymentLabels: Record<PaymentMethod, string> = { MERCADO_PAGO: "Mercado Pago", CASH: "Efectivo en caja", CARD_AT_COUNTER: "Tarjeta en caja", BANK_TRANSFER: "Transferencia bancaria" };

function ars(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100);
}

export default function CheckoutPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [payment, setPayment] = useState<MenuPayment>({ methods: ["CASH", "CARD_AT_COUNTER"], transfer: null });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const total = useMemo(() => cartTotal(cart), [cart]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(loadCart(qrToken));
    let active = true;
    void fetch(`/api/public/menu/${encodeURIComponent(qrToken)}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json() as { categories?: { products?: MenuProduct[] }[]; payment?: MenuPayment };
      if (!active) return;
      setProducts(body.categories?.flatMap((category) => category.products ?? []) ?? []);
      if (body.payment?.methods?.length) {
        setPayment(body.payment);
        setPaymentMethod((current) => body.payment!.methods.includes(current) ? current : body.payment!.methods[0]);
      }
    }).catch(() => { if (active) setMessage("No pudimos cargar los medios de pago. Intentá de nuevo."); });
    return () => { active = false; };
  }, [qrToken]);

  async function copyTransferDetails() {
    const transfer = payment.transfer;
    if (!transfer) return;
    const text = [transfer.alias && `Alias: ${transfer.alias}`, transfer.cbuCvu && `CBU/CVU: ${transfer.cbuCvu}`, transfer.accountHolder && `Titular: ${transfer.accountHolder}`].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setMessage("No pudimos copiar los datos. Seleccionalos manualmente."); }
  }

  async function submit() {
    if (cart.length === 0 || !payment.methods.includes(paymentMethod)) return;
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
      if (!body.id) return;
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
    <main className="qr-welcome-shell">
      <section className="qr-welcome-card checkout-card">
        <ol className="checkout-steps" aria-label="Progreso del pedido"><li className="is-done">Carta</li><li className="is-current">Pago</li><li>Confirmación</li><li>Preparación</li></ol>
        <p className="eyebrow">Paso 2 de 4</p>
        <h1>Confirmá tu pedido</h1>
        {cart.length === 0 ? <p>Tu selección está vacía. Volvé a la carta para agregar productos.</p> : <>
          <ul className="cart-lines">{cart.map((item, index) => { const product = productMap.get(item.productId); const optionNames = product?.optionGroups.flatMap((group) => group.values).filter((value) => item.optionIds.includes(value.id)).map((value) => value.name) ?? []; return <li key={`${item.productId}-${index}`}><div><strong>{item.quantity} × {product?.name ?? "Producto"}</strong>{optionNames.map((name) => <span className="cart-line-detail" key={name}>{name}</span>)}{item.notes && <span className="cart-line-detail">Nota: {item.notes}</span>}</div><strong>{ars(item.displayedTotalCents * item.quantity)}</strong></li>; })}</ul>
          <div className="cart-total"><span>Total</span><strong>{ars(total)}</strong></div>
          <fieldset className="payment-methods"><legend>Elegí cómo pagar</legend>{payment.methods.map((method) => <label className={`payment-choice${paymentMethod === method ? " selected" : ""}`} key={method}><input aria-label={paymentLabels[method]} type="radio" name="payment" checked={paymentMethod === method} onChange={() => { setPaymentMethod(method); setCopied(false); }} /><span><strong>{paymentLabels[method]}</strong><small>{method === "MERCADO_PAGO" ? "Pagás online y volvés al seguimiento." : method === "BANK_TRANSFER" ? "Transferís y Caja confirma el pedido." : "Se confirma en Caja."}</small></span></label>)}</fieldset>
          {paymentMethod === "BANK_TRANSFER" && payment.transfer && <aside className="transfer-instructions"><div><strong>Datos para transferir</strong><span>{payment.transfer.alias && `Alias: ${payment.transfer.alias}`}</span><span>{payment.transfer.cbuCvu && `CBU/CVU: ${payment.transfer.cbuCvu}`}</span><span>{payment.transfer.accountHolder && `Titular: ${payment.transfer.accountHolder}`}</span>{payment.transfer.instructions && <small>{payment.transfer.instructions}</small>}</div><button className="button-secondary" type="button" onClick={() => void copyTransferDetails()}>{copied ? "Datos copiados" : "Copiar datos"}</button></aside>}
          {message && <p className="login-error" role="alert">{message}</p>}
          <button className="primary-link login-button" type="button" disabled={sending || payment.methods.length === 0} onClick={() => void submit()}>{sending ? "Procesando…" : paymentMethod === "MERCADO_PAGO" ? "Ir a Mercado Pago" : "Enviar pedido"}</button>
        </>}
        <button className="secondary-button" type="button" onClick={() => router.push(`/m/${encodeURIComponent(qrToken)}`)}>Volver a la carta</button>
      </section>
    </main>
  );
}
