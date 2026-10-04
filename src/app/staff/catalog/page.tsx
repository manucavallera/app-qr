"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { StaffShell } from "@/components/staff/staff-shell";

type Category = { id: string; name: string; sortOrder: number; visible: boolean };
type ProductValue = { id: string; name: string; priceDeltaCents: number; available: boolean; sortOrder: number };
type ProductGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  values: ProductValue[];
};
type Product = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  imageKey: string | null;
  imageUrl: string | null;
  priceCents: number;
  available: boolean;
  stockQuantity: number | null;
  featured: boolean;
  visible: boolean;
  station: "GENERAL" | "KITCHEN" | "BAR";
  fulfillment: "TABLE" | "PICKUP";
  sortOrder: number;
  category: Category;
  optionGroups: ProductGroup[];
};
type GroupDraft = {
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  values: Array<{ name: string; price: string; available: boolean }>;
};
type ProductDraft = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  /** Empty means the product is not stock-tracked. */
  stock: string;
  available: boolean;
  featured: boolean;
  visible: boolean;
  station: Product["station"];
  fulfillment: Product["fulfillment"];
  sortOrder: number;
  optionGroups: GroupDraft[];
};

const emptyDraft: ProductDraft = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  stock: "",
  available: true,
  featured: false,
  visible: true,
  station: "GENERAL",
  fulfillment: "TABLE",
  sortOrder: 0,
  optionGroups: [],
};

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 })
    .format(cents / 100);
}

function parseCents(value: string): number {
  return Math.round(Number(value.replace(",", ".")) * 100);
}

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "No se pudo guardar el cambio.";
}

export default function StaffCatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [categoryResponse, productResponse] = await Promise.all([
        fetch("/api/staff/catalog/categories", { cache: "no-store" }),
        fetch("/api/staff/catalog/products", { cache: "no-store" }),
      ]);
      if (!categoryResponse.ok || !productResponse.ok) throw new Error("No se pudo cargar el catálogo.");
      setCategories((await categoryResponse.json()) as Category[]);
      setProducts((await productResponse.json()) as Product[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el catálogo.");
    } finally {
      setLoading(false);
    }
  }, []);

  // The async request synchronizes this screen with the server's catalog.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  function updateDraft<Key extends keyof ProductDraft>(key: Key, value: ProductDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setImageFile(null);
    setDraft({
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      price: (product.priceCents / 100).toFixed(2),
      stock: product.stockQuantity === null ? "" : String(product.stockQuantity),
      available: product.available,
      featured: product.featured,
      visible: product.visible,
      station: product.station,
      fulfillment: product.fulfillment,
      sortOrder: product.sortOrder,
      optionGroups: product.optionGroups.map((group) => ({
        name: group.name,
        required: group.required,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        values: group.values.map((value) => ({
          name: value.name,
          price: (value.priceDeltaCents / 100).toFixed(2),
          available: value.available,
        })),
      })),
    });
    setMessage(null);
  }

  function addOptionGroup() {
    setDraft((current) => ({
      ...current,
      optionGroups: [
        ...current.optionGroups,
        {
          name: "",
          required: false,
          minSelections: 0,
          maxSelections: 1,
          values: [{ name: "", price: "0", available: true }],
        },
      ],
    }));
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const body = {
        categoryId: draft.categoryId,
        name: draft.name,
        description: draft.description,
        priceCents: parseCents(draft.price),
        stockQuantity: draft.stock.trim() === "" ? null : Number(draft.stock),
        available: draft.available,
        featured: draft.featured,
        visible: draft.visible,
        station: draft.station,
        fulfillment: draft.fulfillment,
        sortOrder: draft.sortOrder,
        optionGroups: draft.optionGroups.map((group) => ({
          name: group.name,
          required: group.required,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          values: group.values.map((value) => ({
            name: value.name,
            priceDeltaCents: parseCents(value.price),
            available: value.available,
          })),
        })),
      };
      const productResponse = await fetch(
        editingId ? `/api/staff/catalog/products/${editingId}` : "/api/staff/catalog/products",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!productResponse.ok) throw new Error(await responseError(productResponse));

      const savedProduct = (await productResponse.json()) as { id: string };
      if (imageFile) {
        const imageData = new FormData();
        imageData.set("file", imageFile);
        const uploadResponse = await fetch("/api/staff/catalog/images", { method: "POST", body: imageData });
        if (!uploadResponse.ok) throw new Error(await responseError(uploadResponse));
        const uploadedImage = (await uploadResponse.json()) as { key: string };
        const imageUpdate = await fetch(`/api/staff/catalog/products/${savedProduct.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageKey: uploadedImage.key }),
        });
        if (!imageUpdate.ok) throw new Error(await responseError(imageUpdate));
      }

      setEditingId(null);
      setDraft(emptyDraft);
      setImageFile(null);
      setMessage("Producto guardado.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch("/api/staff/catalog/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName, sortOrder: categories.length, visible: true }),
    });
    if (!response.ok) {
      setMessage(await responseError(response));
      return;
    }
    setCategoryName("");
    await refresh();
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    setCategories(reordered.map((category, sortOrder) => ({ ...category, sortOrder })));
    const response = await fetch("/api/staff/catalog/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryIds: reordered.map((category) => category.id) }),
    });
    if (!response.ok) {
      setMessage(await responseError(response));
      await refresh();
    }
  }

  async function setAvailability(product: Product) {
    const response = await fetch(`/api/staff/catalog/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !product.available }),
    });
    if (!response.ok) {
      setMessage(await responseError(response));
      return;
    }
    setProducts((current) => current.map((item) =>
      item.id === product.id ? { ...item, available: !product.available } : item,
    ));
  }

  async function archiveProduct(product: Product) {
    if (!window.confirm(`¿Ocultar ${product.name} del menú?`)) return;
    const response = await fetch(`/api/staff/catalog/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage(await responseError(response));
      return;
    }
    await refresh();
  }

  return (
    <StaffShell title="Menú del bar" section="catalog" role="ADMIN">
      {message ? <p className="staff-message" role="status">{message}</p> : null}

      <section className="staff-panel" aria-labelledby="categories-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Carta</p>
            <h2 id="categories-title">Categorías</h2>
          </div>
          <form className="inline-form" onSubmit={createCategory}>
            <label className="sr-only" htmlFor="new-category">Nueva categoría</label>
            <input
              id="new-category"
              maxLength={80}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Ej. Postres"
              required
              value={categoryName}
            />
            <button className="button-secondary" type="submit">Agregar categoría</button>
          </form>
        </div>
        <ol className="category-list">
          {categories.map((category, index) => (
            <li key={category.id}>
              <span>{category.name}</span>
              <div className="button-row">
                <button aria-label={`Subir ${category.name}`} className="icon-button" disabled={index === 0} onClick={() => void moveCategory(index, -1)} type="button">↑</button>
                <button aria-label={`Bajar ${category.name}`} className="icon-button" disabled={index === categories.length - 1} onClick={() => void moveCategory(index, 1)} type="button">↓</button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="catalog-layout">
        <section className="staff-panel" aria-labelledby="products-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Productos</p>
              <h2 id="products-title">Carta actual</h2>
            </div>
            <button className="button-secondary" onClick={() => { setEditingId(null); setDraft(emptyDraft); }} type="button">Nuevo producto</button>
          </div>
          {loading ? <p className="muted">Cargando carta…</p> : null}
          <div className="product-list">
            {products.map((product) => (
              <article className="product-row" key={product.id}>
                {product.imageUrl ? <Image alt="" className="product-thumb" height={56} src={product.imageUrl} unoptimized width={56} /> : <div aria-hidden="true" className="product-thumb product-placeholder">QR</div>}
                <div className="product-info">
                  <div className="product-title-row">
                    <h3>{product.name}</h3>
                    <span className={product.available && product.visible && product.stockQuantity !== 0 ? "availability-badge is-available" : "availability-badge"}>
                      {!product.visible ? "Oculto" : product.available && product.stockQuantity !== 0 ? "Disponible" : "Agotado"}
                    </span>
                  </div>
                  <p>{product.category.name} · {formatPrice(product.priceCents)}{product.stockQuantity === null ? "" : ` · Stock: ${product.stockQuantity}`}{product.featured ? " · Destacado" : ""}</p>
                  {product.optionGroups.length > 0 ? (
                    <p className="muted">{product.optionGroups.map((group) => group.name).join(" · ")}</p>
                  ) : null}
                </div>
                <div className="button-row product-actions">
                  <button className="button-text" onClick={() => setAvailability(product)} type="button">
                    {product.available ? "Marcar agotado" : "Volver a ofrecer"}
                  </button>
                  <button className="button-text" onClick={() => editProduct(product)} type="button">Editar</button>
                  {product.visible ? <button className="button-text danger-text" onClick={() => void archiveProduct(product)} type="button">Ocultar</button> : null}
                </div>
              </article>
            ))}
            {!loading && products.length === 0 ? <p className="muted">Todavía no hay productos cargados.</p> : null}
          </div>
        </section>

        <section className="staff-panel editor-panel" aria-labelledby="editor-title">
          <p className="eyebrow">{editingId ? "Editar" : "Alta"}</p>
          <h2 id="editor-title">{editingId ? "Producto" : "Nuevo producto"}</h2>
          <form className="staff-form" onSubmit={saveProduct}>
            <label className="form-field">
              <span>Nombre</span>
              <input maxLength={120} onChange={(event) => updateDraft("name", event.target.value)} required value={draft.name} />
            </label>
            <label className="form-field">
              <span>Categoría</span>
              <select onChange={(event) => updateDraft("categoryId", event.target.value)} required value={draft.categoryId}>
                <option value="">Elegí una categoría</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Descripción</span>
              <textarea maxLength={600} onChange={(event) => updateDraft("description", event.target.value)} rows={3} value={draft.description} />
            </label>
            <label className="form-field">
              <span>Precio en pesos</span>
              <input inputMode="decimal" min="0" onChange={(event) => updateDraft("price", event.target.value)} required step="0.01" type="number" value={draft.price} />
            </label>
            <label className="form-field">
              <span>Stock (vacío = sin límite)</span>
              <input inputMode="numeric" min="0" onChange={(event) => updateDraft("stock", event.target.value)} placeholder="Sin límite" step="1" type="number" value={draft.stock} />
            </label>
            <label className="form-field">
              <span>Orden dentro de la categoría</span>
              <input min="0" onChange={(event) => updateDraft("sortOrder", Number(event.target.value))} type="number" value={draft.sortOrder} />
            </label>
            <div className="form-grid-two">
              <label className="form-field">
                <span>Estación</span>
                <select onChange={(event) => updateDraft("station", event.target.value as Product["station"])} value={draft.station}>
                  <option value="GENERAL">General</option>
                  <option value="KITCHEN">Cocina</option>
                  <option value="BAR">Barra</option>
                </select>
              </label>
              <label className="form-field">
                <span>Entrega</span>
                <select onChange={(event) => updateDraft("fulfillment", event.target.value as Product["fulfillment"])} value={draft.fulfillment}>
                  <option value="TABLE">Mesa</option>
                  <option value="PICKUP">Retiro</option>
                </select>
              </label>
            </div>
            <label className="form-field">
              <span>Foto (JPEG, PNG o WebP; hasta 3 MB)</span>
              <input accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} type="file" />
            </label>
            <div className="option-editor-heading">
              <div><h3>Opciones y extras</h3><p className="muted">Por ejemplo, extras con costo o ingredientes para sacar.</p></div>
              <button className="button-secondary" onClick={addOptionGroup} type="button">Agregar grupo</button>
            </div>
            {draft.optionGroups.map((group, groupIndex) => (
              <fieldset className="option-group-editor" key={`${editingId ?? "new"}-${groupIndex}`}>
                <legend>Grupo {groupIndex + 1}</legend>
                <label className="form-field">
                  <span>Nombre del grupo</span>
                  <input maxLength={80} onChange={(event) => setDraft((current) => ({
                    ...current,
                    optionGroups: current.optionGroups.map((item, index) => index === groupIndex ? { ...item, name: event.target.value } : item),
                  }))} required value={group.name} />
                </label>
                <label className="check-field">
                  <input checked={group.required} onChange={(event) => setDraft((current) => ({
                    ...current,
                    optionGroups: current.optionGroups.map((item, index) => index === groupIndex ? {
                      ...item,
                      required: event.target.checked,
                      minSelections: event.target.checked ? Math.max(1, item.minSelections) : item.minSelections,
                    } : item),
                  }))} type="checkbox" />
                  <span>Selección obligatoria</span>
                </label>
                <div className="form-grid-two">
                  <label className="form-field"><span>Mínimo</span><input min="0" onChange={(event) => setDraft((current) => ({ ...current, optionGroups: current.optionGroups.map((item, index) => index === groupIndex ? { ...item, minSelections: Number(event.target.value) } : item) }))} type="number" value={group.minSelections} /></label>
                  <label className="form-field"><span>Máximo</span><input min="1" onChange={(event) => setDraft((current) => ({ ...current, optionGroups: current.optionGroups.map((item, index) => index === groupIndex ? { ...item, maxSelections: Number(event.target.value) } : item) }))} type="number" value={group.maxSelections} /></label>
                </div>
                {group.values.map((value, valueIndex) => (
                  <div className="form-grid-two option-value-row" key={`${groupIndex}-${valueIndex}`}>
                    <label className="form-field"><span>Opción</span><input maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, optionGroups: current.optionGroups.map((item, currentGroup) => currentGroup === groupIndex ? { ...item, values: item.values.map((option, currentValue) => currentValue === valueIndex ? { ...option, name: event.target.value } : option) } : item) }))} required value={value.name} /></label>
                    <label className="form-field"><span>Adicional ($)</span><input inputMode="decimal" min="0" onChange={(event) => setDraft((current) => ({ ...current, optionGroups: current.optionGroups.map((item, currentGroup) => currentGroup === groupIndex ? { ...item, values: item.values.map((option, currentValue) => currentValue === valueIndex ? { ...option, price: event.target.value } : option) } : item) }))} step="0.01" type="number" value={value.price} /></label>
                    <label className="check-field"><input checked={value.available} onChange={(event) => setDraft((current) => ({ ...current, optionGroups: current.optionGroups.map((item, currentGroup) => currentGroup === groupIndex ? { ...item, values: item.values.map((option, currentValue) => currentValue === valueIndex ? { ...option, available: event.target.checked } : option) } : item) }))} type="checkbox" /><span>Disponible</span></label>
                  </div>
                ))}
                <div className="button-row">
                  <button className="button-text" onClick={() => setDraft((current) => ({ ...current, optionGroups: current.optionGroups.map((item, index) => index === groupIndex ? { ...item, values: [...item.values, { name: "", price: "0", available: true }] } : item) }))} type="button">Agregar opción</button>
                  <button className="button-text danger-text" onClick={() => setDraft((current) => ({ ...current, optionGroups: current.optionGroups.filter((_, index) => index !== groupIndex) }))} type="button">Quitar grupo</button>
                </div>
              </fieldset>
            ))}
            <div className="check-row">
              <label className="check-field"><input checked={draft.available} onChange={(event) => updateDraft("available", event.target.checked)} type="checkbox" /><span>Disponible</span></label>
              <label className="check-field"><input checked={draft.featured} onChange={(event) => updateDraft("featured", event.target.checked)} type="checkbox" /><span>Destacado en la carta (Recomendados)</span></label>
              <label className="check-field"><input checked={draft.visible} onChange={(event) => updateDraft("visible", event.target.checked)} type="checkbox" /><span>Visible en el menú</span></label>
            </div>
            <div className="button-row">
              <button className="primary-link" disabled={saving || categories.length === 0} type="submit">{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear producto"}</button>
              {editingId ? <button className="button-text" onClick={() => { setEditingId(null); setDraft(emptyDraft); setImageFile(null); }} type="button">Cancelar edición</button> : null}
            </div>
          </form>
        </section>
      </div>
    </StaffShell>
  );
}
