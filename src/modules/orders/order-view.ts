type Row = Record<string, unknown>;

function record(value: unknown): Row {
  return typeof value === "object" && value !== null ? value as Row : {};
}

export function toOrderView(value: unknown) {
  const order = record(value);
  const table = record(order.table);
  const customerSession = record(order.customerSession);
  const items = Array.isArray(order.items) ? order.items.map((value) => {
    const item = record(value);
    const options = Array.isArray(item.options) ? item.options.map((value) => {
      const option = record(value);
      return {
        groupName: option.groupName,
        valueName: option.valueName,
        priceDeltaCents: option.priceDeltaCents,
      };
    }) : [];
    return {
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitBaseCents: item.unitBaseCents,
      optionsTotalCents: item.optionsTotalCents,
      lineTotalCents: item.lineTotalCents,
      station: item.station,
      fulfillment: item.fulfillment,
      status: item.status,
      notes: item.notes,
      options,
    };
  }) : [];
  const payments = Array.isArray(order.payments) ? order.payments.map((value) => {
    const payment = record(value);
    return { method: payment.method, status: payment.status, amountCents: payment.amountCents, refundedCents: payment.refundedCents };
  }) : [];
  const statusEvents = Array.isArray(order.statusEvents) ? order.statusEvents.map((value) => {
    const event = record(value);
    return { fromStatus: event.fromStatus, toStatus: event.toStatus, reason: event.reason, createdAt: event.createdAt };
  }) : [];

  return {
    id: order.id,
    number: order.number,
    clientRequestId: order.clientRequestId,
    origin: order.origin,
    status: order.status,
    version: order.version,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    table: table.label ? { label: table.label } : null,
    customerName: order.customerName ?? customerSession.nickname ?? null,
    items,
    payments,
    statusEvents,
  };
}
