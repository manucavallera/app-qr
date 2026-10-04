"use client";

import { Minus, Plus, X } from "@phosphor-icons/react";
import Image from "next/image";
import { useState } from "react";
import { Sheet } from "@/components/customer/sheet";
import { useEscapeKey } from "@/lib/client/use-escape-key";
import type { CartItem } from "@/modules/orders/cart-store";
import { formatArs } from "./product-card";

export type MenuProduct = Readonly<{
  id: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  featured?: boolean;
  priceCents: number;
  available: boolean;
  /** Units left when stock is running out; absent or null otherwise. */
  stockLeft?: number | null;
  optionGroups: readonly Readonly<{
    id: string;
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    values: readonly Readonly<{ id: string; name: string; priceDeltaCents: number; available?: boolean }>[];
  }>[];
}>;

export function ProductDialog({
  product,
  initialItem,
  onAdd,
  onClose,
}: {
  product: MenuProduct;
  initialItem?: CartItem;
  onAdd: (item: CartItem) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>(() => Object.fromEntries(
    product.optionGroups.map((group) => [group.id, group.values.filter((value) => initialItem?.optionIds.includes(value.id)).map((value) => value.id)]),
  ));
  const [quantity, setQuantity] = useState(initialItem?.quantity ?? 1);
  const [notes, setNotes] = useState(initialItem?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(onClose);
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
    <div className="cm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <Sheet labelledBy="product-dialog-title">
        <button className="cm-close" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} weight="bold" aria-hidden="true" /></button>
        {product.imageUrl && <Image className="cm-sheet-image" src={product.imageUrl} alt="" width={560} height={320} unoptimized />}
        <div className="cm-sheet-body">
          <h2 id="product-dialog-title">{product.name}</h2>
          {product.description && <p className="cm-sheet-desc">{product.description}</p>}
          <p className="cm-base-price">Desde {formatArs(product.priceCents)}</p>
          <div className="cm-options">
            {product.optionGroups.map((group) => (
              <fieldset key={group.id} className="cm-group">
                <legend>{group.name}{group.required && <span> · obligatorio</span>}</legend>
                {group.values.map((value) => {
                  const checked = (selected[group.id] ?? []).includes(value.id);
                  if (value.available === false) return null;
                  return (
                    <label key={value.id} className="cm-option">
                      <input
                        // An optional single choice must be un-checkable, which a radio is not.
                        type={group.maxSelections === 1 && group.minSelections >= 1 ? "radio" : "checkbox"}
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
          <label className="cm-field">
            Nota para la cocina
            <textarea className="cm-input" rows={2} maxLength={160} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. sin mayonesa" />
          </label>
          {error && <p role="alert" className="cm-error">{error}</p>}
        </div>
        <div className="cm-sheet-footer">
          <div className="cm-stepper" aria-label="Cantidad">
            <button type="button" aria-label="Restar uno" disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}><Minus size={18} weight="bold" aria-hidden="true" /></button>
            <span>{quantity}</span>
            <button type="button" aria-label="Sumar uno" disabled={quantity >= (product.stockLeft ?? 99)} onClick={() => setQuantity((value) => Math.min(product.stockLeft ?? 99, 99, value + 1))}><Plus size={18} weight="bold" aria-hidden="true" /></button>
          </div>
          <button className="cm-btn" type="button" onClick={add}>{initialItem ? "Guardar cambios" : "Agregar al carrito"} · {formatArs(unitTotal * quantity)}</button>
        </div>
      </Sheet>
    </div>
  );
}
