"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { ProductDialog, type MenuProduct } from "@/modules/catalog/components/product-dialog";
import { addToCart, canPersistCart, cartTotal, clearCart, loadCart, removeCartItem, replaceCartItem, saveCart, type CartItem } from "@/modules/orders/cart-store";
import { MenuHeader, type PublicBusiness } from "./menu-header";
import { filterMenuCategories } from "./menu-filter";

type PublicMenu = Readonly<{
  table: { label: string };
  mode: "QR_OPEN" | "COUNTER_ONLY" | "PAUSED";
  business: PublicBusiness;
  service: { mode: "QR_OPEN" | "COUNTER_ONLY" | "PAUSED"; hoursLabel: string | null };
  categories: ReadonlyArray<{ id: string; name: string; products: ReadonlyArray<MenuProduct & { imageUrl: string | null }> }>;
  serverTime: string;
}>;

type SessionStatus = "checking" | "needs-name" | "starting" | "ready" | "error";

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100);
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (body?.error === "TABLE_NOT_FOUND") return "Este código QR ya no está activo. Avisale a alguien del bar.";
  if (body?.error === "RATE_LIMITED") return "Hubo varios intentos seguidos. Esperá un momento y probá otra vez.";
  return "No pudimos cargar la carta. Revisá tu conexión e intentá de nuevo.";
}

export function MenuClient({ qrToken }: { qrToken: string }) {
  const [nickname, setNickname] = useState("");
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoadedForToken, setCartLoadedForToken] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(null);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const loadMenu = useCallback(async (): Promise<PublicMenu> => {
    const response = await fetch(`/api/public/menu/${encodeURIComponent(qrToken)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await readError(response));
    return response.json() as Promise<PublicMenu>;
  }, [qrToken]);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/public/qr/${encodeURIComponent(qrToken)}/session`, { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const current = await response.json() as { nickname: string | null };
      if (!current.nickname) {
        setSessionStatus("needs-name");
        return;
      }
      const loadedMenu = await loadMenu();
      setNickname(current.nickname);
      setMenu(loadedMenu);
      setSessionStatus("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos abrir la carta.");
      setSessionStatus("error");
    }
  }, [qrToken, loadMenu]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void checkSession(); }, 0);
    return () => window.clearTimeout(timer);
  }, [checkSession]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCart(loadCart(qrToken));
      setCartLoadedForToken(qrToken);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [qrToken]);

  useEffect(() => {
    if (canPersistCart(cartLoadedForToken, qrToken)) saveCart(qrToken, cart);
  }, [cart, cartLoadedForToken, qrToken]);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const products = useMemo(() => new Map(menu?.categories.flatMap((category) => category.products.map((product) => [product.id, product] as const)) ?? []), [menu]);
  const visibleCategories = useMemo(() => filterMenuCategories(menu?.categories ?? [], activeCategoryId), [activeCategoryId, menu]);

  async function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSessionStatus("starting");
    try {
      const response = await fetch(`/api/public/qr/${encodeURIComponent(qrToken)}/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json() as { nickname: string };
      clearCart(qrToken);
      setCart([]);
      const loadedMenu = await loadMenu();
      setNickname(result.nickname);
      setMenu(loadedMenu);
      setSessionStatus("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos iniciar tu sesión.");
      setSessionStatus("needs-name");
    }
  }

  if (sessionStatus === "checking") {
    return <main className="menu-loading" aria-live="polite"><span className="menu-loader" aria-hidden="true" />Abriendo la carta…</main>;
  }

  if (sessionStatus === "error") {
    return <main className="qr-welcome-shell"><section className="qr-welcome-card"><p className="eyebrow">No pudimos conectar</p><h1>La carta no cargó</h1><p>{message}</p><button className="primary-link login-button" type="button" onClick={() => { setMessage(null); setSessionStatus("checking"); void checkSession(); }}>Reintentar</button></section></main>;
  }

  if (sessionStatus === "needs-name" || sessionStatus === "starting") {
    const starting = sessionStatus === "starting";
    return (
      <main className="qr-welcome-shell">
        <section className="qr-welcome-card">
          <p className="eyebrow">Tu mesa, tu pedido</p>
          <h1>¿Cómo te llamamos?</h1>
          <p>Así podemos identificar tus pedidos cuando pidas en el bar.</p>
          <form className="login-form" onSubmit={startSession}>
            <label className="form-field" htmlFor="customer-nickname">Tu nombre o apodo
              <input id="customer-nickname" className="form-input" autoComplete="nickname" autoFocus disabled={starting} minLength={1} maxLength={40} value={nickname} onChange={(event) => setNickname(event.target.value)} required />
            </label>
            {message && <p className="login-error" role="alert">{message}</p>}
            <button className="primary-link login-button" type="submit" disabled={starting}>{starting ? "Abriendo…" : "Ver la carta"}</button>
          </form>
        </section>
      </main>
    );
  }

  if (!menu) return null;

  const canOrder = menu.service.mode === "QR_OPEN";
  const modeMessage = menu.service.mode === "PAUSED"
    ? "Los pedidos están pausados por el local. Podés seguir viendo la carta."
    : "La autogestión por QR está cerrada por ahora. Podés pedir en la barra o caja.";

  function closeProductDialog() {
    setSelectedProduct(null);
    setEditingCartIndex(null);
  }

  function saveProduct(item: CartItem) {
    setCart((current) => editingCartIndex === null ? addToCart(current, item) : replaceCartItem(current, editingCartIndex, item));
    closeProductDialog();
  }

  function clearCurrentCart() {
    clearCart(qrToken);
    setCart([]);
    setCartOpen(false);
  }

  return (
    <main className="public-menu-shell">
      <MenuHeader business={menu.business} hoursLabel={menu.service.hoursLabel} />
      <header className="public-menu-header">
        <div className="menu-hero-copy">
          <div className="menu-hero-meta"><span className="table-badge">{menu.table.label}</span><span>Menú digital</span></div>
          <h1>Elegí algo rico.</h1>
          <p className="menu-subtitle">Todo lo que sale de la cocina, directo a tu mesa.</p>
        </div>
        <p className="menu-greeting">Hola, {nickname}</p>
      </header>
      {!canOrder && <aside className={`service-mode-note${menu.service.mode === "PAUSED" ? " is-paused" : ""}`} role="status">{modeMessage}</aside>}
      <nav className="category-nav" aria-label="Categorías">
        <button className={activeCategoryId === null ? "is-active" : ""} type="button" aria-pressed={activeCategoryId === null} onClick={() => setActiveCategoryId(null)}>Todo</button>
        {menu.categories.map((category) => <button className={activeCategoryId === category.id ? "is-active" : ""} key={category.id} type="button" aria-pressed={activeCategoryId === category.id} onClick={() => setActiveCategoryId(category.id)}>{category.name}</button>)}
      </nav>
      {visibleCategories.map((category) => (
        <section id={`category-${category.id}`} className="menu-category" key={category.id}>
          <div className="menu-category-heading"><h2>{category.name}</h2><span>{category.products.length} opciones</span></div>
          <div className="menu-product-list">
            {category.products.map((product) => <ProductCard key={product.id} product={product} onSelect={setSelectedProduct} />)}
          </div>
        </section>
      ))}
      {menu.categories.length === 0 && <p className="menu-empty-state">Todavía no hay productos publicados en la carta.</p>}
      {message && <p className="login-error menu-message" role="alert">{message}</p>}
      {cart.length > 0 && (
        <button className="sticky-cart" type="button" onClick={() => setCartOpen(true)}>
          <span className="sticky-cart-summary">
            <span>{cart.reduce((count, item) => count + item.quantity, 0)} {cart.length === 1 ? "producto" : "productos"}</span>
            <strong>{formatPrice(total)}</strong>
          </span>
          <span className="sticky-cart-action">{canOrder ? "Ver pedido" : "Ver selección"}</span>
        </button>
      )}
      {selectedProduct && <ProductDialog product={selectedProduct} initialItem={editingCartIndex === null ? undefined : cart[editingCartIndex]} onClose={closeProductDialog} onAdd={saveProduct} />}
      {cartOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <section className="cart-dialog" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <button className="dialog-close" type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar">×</button>
            <p className="eyebrow">Tu selección</p><h2 id="cart-title">El pedido de {menu.table.label}</h2>
            <button className="cart-clear-button" type="button" onClick={clearCurrentCart}>Vaciar pedido</button>
            <ul className="cart-lines">
              {cart.map((item, index) => {
                const product = products.get(item.productId);
                return <li key={`${item.productId}-${index}`}>
                  <div><strong>{item.quantity} × {product?.name ?? "Producto"}</strong>
                    {item.optionIds.map((id) => <span className="cart-line-detail" key={id}>{product?.optionGroups.flatMap((group) => group.values).find((value) => value.id === id)?.name}</span>)}
                    {item.notes && <span className="cart-line-detail">Nota: {item.notes}</span>}
                  </div>
                  <div className="cart-line-actions"><strong>{formatPrice(item.displayedTotalCents * item.quantity)}</strong>
                    <div className="cart-line-buttons">
                      <button className="cart-line-edit" type="button" onClick={() => { if (!product) return; setEditingCartIndex(index); setSelectedProduct(product); setCartOpen(false); }}>Editar</button>
                      <button className="cart-line-remove" type="button" onClick={() => setCart((current) => removeCartItem(current, index))}>Quitar</button>
                    </div>
                    <div className="cart-line-quantity" aria-label={`Cantidad de ${product?.name ?? "producto"}`}>
                      <button type="button" aria-label={`Restar una porción de ${product?.name ?? "producto"}`} onClick={() => setCart((current) => current.flatMap((line, lineIndex) => lineIndex !== index ? [line] : line.quantity > 1 ? [{ ...line, quantity: line.quantity - 1 }] : []))}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" aria-label={`Agregar una porción de ${product?.name ?? "producto"}`} onClick={() => setCart((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line))}>+</button>
                    </div>
                  </div>
                </li>;
              })}
            </ul>
            <div className="cart-total"><span>Total estimado</span><strong>{formatPrice(total)}</strong></div>
            {canOrder ? <a className="primary-link cart-continue" href={`/m/${encodeURIComponent(qrToken)}/checkout`}>Continuar con el pedido</a> : <p className="cart-counter-note">Cuando quieras pedir, acercate a la barra o caja.</p>}
          </section>
        </div>
      )}
    </main>
  );
}
