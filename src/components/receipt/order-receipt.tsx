import { formatArs } from "@/lib/format";
import { paymentMethodLabel, type PaymentMethodValue } from "@/modules/payments/payment-methods";
import { selectCurrentPayment } from "@/modules/payments/payment-selection";

export type ReceiptOrder = Readonly<{
  number: number;
  createdAt: string;
  totalCents: number;
  table: { label: string } | null;
  customerName: string | null;
  items: ReadonlyArray<{ productName: string; quantity: number; lineTotalCents: number; notes: string | null; options: ReadonlyArray<{ valueName: string }> }>;
  payments: ReadonlyArray<{ method: string; status: string }>;
}>;

/**
 * Non-fiscal order receipt. Without an ARCA authorization (CAE) it must not be
 * presented as an invoice, so the footer says so on every copy.
 */
export function OrderReceipt({ order, businessName }: { order: ReceiptOrder; businessName: string }) {
  const payment = selectCurrentPayment(order.payments);
  const paid = payment?.status === "APPROVED";
  return (
    <article className="receipt" aria-label={`Comprobante del pedido ${order.number}`}>
      <header className="receipt-header">
        <strong>{businessName}</strong>
        <span>Comprobante de pedido</span>
      </header>
      <dl className="receipt-meta">
        <div><dt>Pedido</dt><dd>#{order.number}</dd></div>
        <div><dt>Fecha</dt><dd>{new Date(order.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</dd></div>
        <div><dt>{order.table ? "Mesa" : "Retiro"}</dt><dd>{order.table?.label ?? "Mostrador"}</dd></div>
        {order.customerName && <div><dt>Cliente</dt><dd>{order.customerName}</dd></div>}
      </dl>
      <ul className="receipt-items">
        {order.items.map((item, index) => (
          <li key={`${item.productName}-${index}`}>
            <div className="receipt-line"><span>{item.quantity} × {item.productName}</span><span>{formatArs(item.lineTotalCents)}</span></div>
            {item.options.map((option) => <small key={option.valueName}>{option.valueName}</small>)}
            {item.notes && <small>Nota: {item.notes}</small>}
          </li>
        ))}
      </ul>
      <div className="receipt-line receipt-total"><span>Total</span><span>{formatArs(order.totalCents)}</span></div>
      <p className="receipt-payment">{payment ? paymentMethodLabel(payment.method as PaymentMethodValue) : "Sin medio de pago"} · {paid ? "Pagado" : "Pago pendiente"}</p>
      <footer className="receipt-footer">Documento no válido como factura.</footer>
    </article>
  );
}
