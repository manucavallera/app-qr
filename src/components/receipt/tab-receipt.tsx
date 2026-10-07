import { formatArs } from "@/lib/format";

export type ReceiptTab = Readonly<{
  number: number;
  label: string;
  openedAt: string;
  totalCents: number;
  people: ReadonlyArray<{
    key: string;
    name: string;
    totalCents: number;
    orders: ReadonlyArray<{ number: number; items: ReadonlyArray<{ productName: string; quantity: number; lineTotalCents: number }> }>;
  }>;
}>;

/**
 * The whole table's bill: what each person owes and the total, to hand over when
 * the table asks to pay. Like the order receipt, it is not a fiscal invoice.
 */
export function TabReceipt({ tab, businessName }: { tab: ReceiptTab; businessName: string }) {
  const split = tab.people.length > 1;
  return (
    <article className="receipt" aria-label={`Cuenta de ${tab.label}`}>
      <header className="receipt-header">
        <strong>{businessName}</strong>
        <span>Cuenta de la mesa</span>
      </header>
      <dl className="receipt-meta">
        <div><dt>Mesa</dt><dd>{tab.label}</dd></div>
        <div><dt>Cuenta</dt><dd>#{tab.number}</dd></div>
        <div><dt>Abierta</dt><dd>{new Date(tab.openedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</dd></div>
      </dl>
      {tab.people.map((person) => (
        <section className="receipt-person" key={person.key} aria-label={person.name}>
          {split && <h2>{person.name}</h2>}
          <ul className="receipt-items">
            {person.orders.flatMap((order) => order.items.map((item, index) => (
              <li key={`${order.number}-${item.productName}-${index}`}>
                <div className="receipt-line"><span>{item.quantity} × {item.productName}</span><span>{formatArs(item.lineTotalCents)}</span></div>
              </li>
            )))}
          </ul>
          {split && <div className="receipt-line receipt-subtotal"><span>Subtotal {person.name}</span><span>{formatArs(person.totalCents)}</span></div>}
        </section>
      ))}
      <div className="receipt-line receipt-total"><span>Total</span><span>{formatArs(tab.totalCents)}</span></div>
      <p className="receipt-payment">Pago pendiente</p>
      <footer className="receipt-footer">Documento no válido como factura.</footer>
    </article>
  );
}
