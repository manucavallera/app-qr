import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { calculateQuote, type QuoteProduct, type QuoteRequest } from "./quote";

const burger: QuoteProduct = {
  id: "burger",
  name: "Hamburguesa",
  priceCents: 1_000_000,
  available: true,
  visible: true,
  station: "KITCHEN",
  fulfillment: "TABLE",
  optionGroups: [
    {
      id: "cooking-point",
      name: "Punto de cocción",
      required: true,
      minSelections: 1,
      maxSelections: 1,
      values: [
        { id: "medium", name: "A punto", priceDeltaCents: 0, available: true },
        { id: "rare", name: "Jugosa", priceDeltaCents: 0, available: true },
      ],
    },
    {
      id: "extras",
      name: "Extras",
      required: false,
      minSelections: 0,
      maxSelections: 2,
      values: [
        { id: "cheese", name: "Queso", priceDeltaCents: 50_000, available: true },
        { id: "bacon", name: "Panceta", priceDeltaCents: 50_000, available: true },
        { id: "egg", name: "Huevo", priceDeltaCents: 50_000, available: true },
        { id: "out-of-stock", name: "Palta", priceDeltaCents: 70_000, available: false },
      ],
    },
  ],
};

const availableProducts = [burger];

function request(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return {
    expectedTotalCents: 1_000_000,
    items: [{ productId: "burger", quantity: 1, optionValueIds: ["medium"] }],
    ...overrides,
  };
}

function expectDomainCode(action: () => unknown, code: string) {
  try {
    action();
    expect.fail(`Expected a DomainError with code ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
  }
}

describe("calculateQuote", () => {
  it("uses the server catalog and snapshots selected options", () => {
    const result = calculateQuote(request(), availableProducts);

    expect(result).toMatchObject({
      totalCents: 1_000_000,
      items: [
        {
          productId: "burger",
          productName: "Hamburguesa",
          quantity: 1,
          unitBaseCents: 1_000_000,
          optionsTotalCents: 0,
          lineTotalCents: 1_000_000,
          options: [{ optionValueId: "medium", groupName: "Punto de cocción", valueName: "A punto" }],
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.items[0])).toBe(true);
  });

  it("requires a selection from required groups", () => {
    expectDomainCode(
      () => calculateQuote(request({ items: [{ productId: "burger", quantity: 1, optionValueIds: [] }] }), availableProducts),
      "REQUIRED_OPTION_GROUP",
    );
  });

  it("rejects more selected values than a group allows", () => {
    expectDomainCode(
      () =>
        calculateQuote(
          request({
            expectedTotalCents: 1_100_000,
            items: [{ productId: "burger", quantity: 1, optionValueIds: ["medium", "cheese", "bacon", "egg"] }],
          }),
          availableProducts,
        ),
      "OPTION_SELECTION_LIMIT",
    );
  });

  it("rejects unavailable products and unavailable option values", () => {
    expectDomainCode(
      () => calculateQuote(request(), [{ ...burger, available: false }]),
      "PRODUCT_UNAVAILABLE",
    );
    expectDomainCode(
      () =>
        calculateQuote(
          request({ items: [{ productId: "burger", quantity: 1, optionValueIds: ["medium", "out-of-stock"] }] }),
          availableProducts,
        ),
      "OPTION_UNAVAILABLE",
    );
  });

  it.each([0, 21])("rejects quantity %s", (quantity) => {
    expectDomainCode(
      () =>
        calculateQuote(
          request({ items: [{ productId: "burger", quantity, optionValueIds: ["medium"] }] }),
          availableProducts,
        ),
      "INVALID_QUANTITY",
    );
  });

  it("detects a total that differs from the server calculation", () => {
    expectDomainCode(
      () => calculateQuote(request({ expectedTotalCents: 1 }), availableProducts),
      "TOTAL_MISMATCH",
    );
  });

  it("calculates two extras on each of two burgers in cents", () => {
    const result = calculateQuote(
      request({
        expectedTotalCents: 2_200_000,
        items: [{ productId: "burger", quantity: 2, optionValueIds: ["medium", "cheese", "bacon"] }],
      }),
      availableProducts,
    );

    expect(result.totalCents).toBe(2_200_000);
    expect(result.items[0]).toMatchObject({
      unitBaseCents: 1_000_000,
      optionsTotalCents: 100_000,
      lineTotalCents: 2_200_000,
    });
  });
});
