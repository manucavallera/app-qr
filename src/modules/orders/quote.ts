import { DomainError } from "./errors";

export type QuoteProduct = Readonly<{
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
  visible: boolean;
  station: "GENERAL" | "KITCHEN" | "BAR";
  fulfillment: "TABLE" | "PICKUP";
  optionGroups: readonly Readonly<{
    id: string;
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    values: readonly Readonly<{
      id: string;
      name: string;
      priceDeltaCents: number;
      available: boolean;
    }>[];
  }>[];
}>;

export type QuoteRequest = Readonly<{
  expectedTotalCents: number;
  items: readonly Readonly<{
    productId: string;
    quantity: number;
    optionValueIds: readonly string[];
    notes?: string;
  }>[];
}>;

export type QuotedOrderItem = Readonly<{
  productId: string;
  productName: string;
  quantity: number;
  unitBaseCents: number;
  optionsTotalCents: number;
  lineTotalCents: number;
  station: QuoteProduct["station"];
  fulfillment: QuoteProduct["fulfillment"];
  notes?: string;
  options: readonly Readonly<{
    optionValueId: string;
    groupName: string;
    valueName: string;
    priceDeltaCents: number;
  }>[];
}>;

export type OrderQuote = Readonly<{
  totalCents: number;
  items: readonly QuotedOrderItem[];
}>;

function assertMoney(value: number, code: string, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError(code, `${label} debe ser un importe válido en centavos.`);
  }
}

function validateOptionGroup(product: QuoteProduct, group: QuoteProduct["optionGroups"][number]): void {
  if (
    !Number.isInteger(group.minSelections) ||
    !Number.isInteger(group.maxSelections) ||
    group.minSelections < 0 ||
    group.maxSelections < 0 ||
    group.minSelections > group.maxSelections ||
    (group.required && group.maxSelections < 1)
  ) {
    throw new DomainError("INVALID_OPTION_GROUP", "Un grupo de opciones tiene límites inválidos.", {
      productId: product.id,
      optionGroupId: group.id,
    });
  }
}

function freezeItem(item: QuotedOrderItem): QuotedOrderItem {
  const options = Object.freeze(item.options.map((option) => Object.freeze({ ...option })));
  return Object.freeze({ ...item, options });
}

export function calculateQuote(
  request: QuoteRequest,
  catalog: readonly QuoteProduct[],
): OrderQuote {
  assertMoney(request.expectedTotalCents, "INVALID_EXPECTED_TOTAL", "El total esperado");
  if (request.items.length === 0) {
    throw new DomainError("EMPTY_ORDER", "El pedido debe incluir al menos un producto.");
  }

  const productsById = new Map(catalog.map((product) => [product.id, product]));
  const quotedItems: QuotedOrderItem[] = [];
  let totalCents = 0;

  for (const requestedItem of request.items) {
    const product = productsById.get(requestedItem.productId);
    if (!product) {
      throw new DomainError("PRODUCT_NOT_FOUND", "Uno de los productos ya no está disponible.", {
        productId: requestedItem.productId,
      });
    }
    if (!product.available || !product.visible) {
      throw new DomainError("PRODUCT_UNAVAILABLE", "Uno de los productos no está disponible.", {
        productId: product.id,
      });
    }
    if (!Number.isInteger(requestedItem.quantity) || requestedItem.quantity < 1 || requestedItem.quantity > 20) {
      throw new DomainError("INVALID_QUANTITY", "La cantidad debe estar entre 1 y 20.", {
        productId: product.id,
      });
    }
    assertMoney(product.priceCents, "INVALID_PRODUCT_PRICE", "El precio del producto");

    const selectedIds = requestedItem.optionValueIds;
    if (new Set(selectedIds).size !== selectedIds.length) {
      throw new DomainError("DUPLICATE_OPTION_SELECTION", "No se puede seleccionar la misma opción más de una vez.");
    }

    const groupsById = new Map(product.optionGroups.map((group) => [group.id, group]));
    for (const group of product.optionGroups) validateOptionGroup(product, group);

    const selectedByGroup = new Map<string, QuoteProduct["optionGroups"][number]["values"][number][]>();
    const optionSnapshots: QuotedOrderItem["options"][number][] = [];

    for (const optionValueId of selectedIds) {
      const matching = product.optionGroups
        .map((group) => ({ group, value: group.values.find((value) => value.id === optionValueId) }))
        .find((entry) => entry.value !== undefined);

      if (!matching?.value) {
        throw new DomainError("INVALID_OPTION_SELECTION", "Una opción seleccionada no pertenece al producto.", {
          productId: product.id,
          optionValueId,
        });
      }
      if (!matching.value.available) {
        throw new DomainError("OPTION_UNAVAILABLE", "Una de las opciones elegidas no está disponible.", {
          optionValueId,
        });
      }
      assertMoney(matching.value.priceDeltaCents, "INVALID_OPTION_PRICE", "El adicional de una opción");

      const selections = selectedByGroup.get(matching.group.id) ?? [];
      selections.push(matching.value);
      selectedByGroup.set(matching.group.id, selections);
      optionSnapshots.push({
        optionValueId: matching.value.id,
        groupName: matching.group.name,
        valueName: matching.value.name,
        priceDeltaCents: matching.value.priceDeltaCents,
      });
    }

    let optionsTotalCents = 0;
    for (const [groupId, group] of groupsById) {
      const count = selectedByGroup.get(groupId)?.length ?? 0;
      const minimum = Math.max(group.minSelections, group.required ? 1 : 0);
      if (count < minimum) {
        throw new DomainError("REQUIRED_OPTION_GROUP", `Elegí una opción de ${group.name}.`, {
          productId: product.id,
          optionGroupId: group.id,
        });
      }
      if (count > group.maxSelections) {
        throw new DomainError("OPTION_SELECTION_LIMIT", `Elegiste demasiadas opciones de ${group.name}.`, {
          productId: product.id,
          optionGroupId: group.id,
          maximum: group.maxSelections,
        });
      }
    }

    for (const option of optionSnapshots) optionsTotalCents += option.priceDeltaCents;
    const unitTotalCents = product.priceCents + optionsTotalCents;
    assertMoney(unitTotalCents, "INVALID_LINE_TOTAL", "El importe por unidad");
    const lineTotalCents = unitTotalCents * requestedItem.quantity;
    assertMoney(lineTotalCents, "INVALID_LINE_TOTAL", "El total de la línea");
    totalCents += lineTotalCents;
    assertMoney(totalCents, "INVALID_ORDER_TOTAL", "El total del pedido");

    quotedItems.push(
      freezeItem({
        productId: product.id,
        productName: product.name,
        quantity: requestedItem.quantity,
        unitBaseCents: product.priceCents,
        optionsTotalCents,
        lineTotalCents,
        station: product.station,
        fulfillment: product.fulfillment,
        ...(requestedItem.notes === undefined ? {} : { notes: requestedItem.notes }),
        options: optionSnapshots,
      }),
    );
  }

  if (totalCents !== request.expectedTotalCents) {
    throw new DomainError("TOTAL_MISMATCH", "El total cambió; actualizá el pedido antes de continuar.", {
      expectedTotalCents: request.expectedTotalCents,
      actualTotalCents: totalCents,
    });
  }

  return Object.freeze({ totalCents, items: Object.freeze(quotedItems) });
}
