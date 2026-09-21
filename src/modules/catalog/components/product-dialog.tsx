"use client";

import { useState } from "react";
import type { CartItem } from "@/modules/orders/cart-store";
import { formatArs } from "./product-card";

export type MenuProduct = Readonly<{
  id: string;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  optionGroups: readonly Readonly<{
    id: string;
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    values: readonly Readonly<{ id: string; name: string; priceDeltaCents: number }>[];
  }>[];
}>;

export function ProductDialog({
  product,
  onAdd,
  onClose,
}: {
  product: MenuProduct;
  onAdd: (item: CartItem) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chosenIds = Object.values(selected).flat();
  const selectedValues = product.optionGroups.flatMap((group) => group.values.filter((value) => chosenIds.includes(value.id)));
  const unitTotal = product.priceCents + selectedValues.reduce((sum, value) => sum + value.priceDeltaCents, 0);

  function toggleValue(groupId: string, valueId: string, maximum: number) {
    setSelected((current) => {
      const values = current[groupId] ?? [];
      const next = values.includes(valueId)
        ? values.filter((id) => id !== valueId)
        : maximum === 1 ? [valueId] : values.length < maximum ? [...values, valueId] : values;
      return { ...current, [groupId]: next };
    });
    setError(null);
  }

  function add() {
    const invalid = product.optionGroups.find((group) => (selected[group.id]?.length ?? 0) < group.minSelections);
    if (invalid) {
      setError(`Elegí ${invalid.name.toLocaleLowerCase("es-AR")} para continuar.`);
      return;
    }
    onAdd({ productId: product.id, optionIds: chosenIds, notes: notes.trim(), quantity, displayedTotalCents: unitTotal });
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        <p className="eyebrow">Personalizá tu pedido</p>
        <h2 id="product-dialog-title">{product.name}</h2>
        {product.description && <p className="dialog-description">{product.description}</p>}
        <p className="dialog-base-price">Desde {formatArs(product.priceCents)}</p>
        <div className="dialog-options">
          {product.optionGroups.map((group) => (
            <fieldset key={group.id} className="dialog-option-group">
              <legend>{group.name}{group.required && <span> · obligatorio</span>}</legend>
              {group.values.map((value) => {
                const checked = (selected[group.id] ?? []).includes(value.id);
                return (
                  <label key={value.id} className="dialog-option">
                    <input
                      type={group.maxSelections === 1 ? "radio" : "checkbox"}
                      name={`option-${group.id}`}
                      checked={checked}
                      onChange={() => toggleValue(group.id, value.id, group.maxSelections)}
                    />
                    <span>{value.name}</span>
                    {value.priceDeltaCents > 0 && <span>+{formatArs(value.priceDeltaCents)}</span>}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
        <label className="form-field">
          Nota para la cocina
          <textarea className="form-input dialog-notes" maxLength={250} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. sin hielo" />
        </label>
        {error && <p role="alert" className="login-error">{error}</p>}
        <div className="dialog-footer">
          <div className="quantity-control" aria-label="Cantidad">
            <button type="button" aria-label="Restar uno" disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}>−</button>
            <span>{quantity}</span>
            <button type="button" aria-label="Sumar uno" onClick={() => setQuantity((value) => Math.min(99, value + 1))}>＋</button>
          </div>
          <button className="primary-link" type="button" onClick={add}>Agregar al carrito · {formatArs(unitTotal * quantity)}</button>
        </div>
      </section>
    </div>
  );
}
