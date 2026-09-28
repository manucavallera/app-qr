import { describe, expect, it } from "vitest";
import { filterMenuCategories } from "./menu-filter";

describe("menu category filters", () => {
  const categories = [{ id: "burgers", name: "Hamburguesas" }, { id: "drinks", name: "Bebidas" }];

  it("shows every category by default", () => {
    expect(filterMenuCategories(categories, null)).toEqual(categories);
  });

  it("shows only the selected category", () => {
    expect(filterMenuCategories(categories, "drinks")).toEqual([categories[1]]);
  });
});
