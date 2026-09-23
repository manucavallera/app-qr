"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { ProductDialog, type MenuProduct } from "@/modules/catalog/components/product-dialog";
import { addToCart, cartTotal, loadCart, saveCart, type CartItem } from "@/modules/orders/cart-store";

type PublicMenu = Readonly<{
  table: { label: string };
  mode: "QR_OPEN" | "COUNTER_ONLY" | "PAUSED";
  categories: ReadonlyArray<{ id: string; name: string; products: ReadonlyArray<MenuProduct & { imageUrl: string | null }> }>;
  serverTime: string;
}>;

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
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const loadMenu = useCallback(async () => {
    const response = await fetch(`/api/public/menu/${encodeURIComponent(qrToken)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await readError(response));
    setMenu(await response.json() as PublicMenu);
  }, [qrToken]);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const response = await fetch(`/api/public/qr/${encodeURIComponent(qrToken)}/session`, { cache: "no-store" });
        if (!active) return;
        if (response.ok) {
          const current = await response.json() as { nickname: string };
          if (!active) return;
          setNickname(current.nickname);
          await loadMenu();
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "No pudimos abrir la carta.");
      } finally {
        if (active) setSessionChecked(true);
      }
    }
    void checkSession();
    return () => { active = false; };
  }, [qrToken, loadMenu]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCart(loadCart(qrToken));
      setCartReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [qrToken]);

  useEffect(() => {
    if (cartReady) saveCart(qrToken, cart);
  }, [cart, cartReady, qrToken]);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const products = useMemo(() => new Map(menu?.categories.flatMap((category) => category.products.map((product) => [product.id, product] as const)) ?? []), [menu]);

  async function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/public/qr/${encodeURIComponent(qrToken)}/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json() as { nickname: string };
      setNickname(result.nickname);
      await loadMenu();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos iniciar tu sesión.");
    } finally {
      setLoading(false);
    }
  }

  if (!sessionChecked) {
    return <main className="menu-loading" aria-live="polite">Abriendo la carta…</main>;
  }

  if (!menu) {
    return (
      <main className="qr-welcome-shell">
        <section className="qr-welcome-card">
          <p className="eyebrow">Bienvenido</p>
          <h1>¿Cómo te llamamos?</h1>
          <p>Así podemos identificar tus pedidos cuando pidas en el bar.</p>
          <form className="login-form" onSubmit={startSession}>
            <label className="form-field" htmlFor="customer-nickname">Tu nombre o apodo
              <input id="customer-nickname" className="form-input" autoComplete="nickname" autoFocus minLength={1} maxLength={40} value={nickname} onChange={(event) => setNickname(event.target.value)} required />
            </label>
            {message && <p className="login-error" role="alert">{message}</p>}
            <button className="primary-link login-button" type="submit" disabled={loading}>{loading ? "Entrando…" : "Ver la carta"}</button>
          </form>
        </section>
      </main>
    );
  }

  const canOrder = menu.mode === "QR_OPEN";
  const modeMessage = menu.mode === "PAUSED"
    ? "Los pedidos están pausados por el local. Podés seguir viendo la carta."
    : "La autogestión por QR está cerrada por ahora. Podés pedir en la barra o caja.";

  return (
    <main className="public-menu-shell">
      <header className="public-menu-header">
        <div><p className="eyebrow">Bar · {menu.table.label}</p><h1>La carta</h1></div>
        <p className="menu-greeting">Hola, {nickname}</p>
      </header>
      {!canOrder && <aside className={`service-mode-note${menu.mode === "PAUSED" ? " is-paused" : ""}`} role="status">{modeMessage}</aside>}
      <nav className="category-nav" aria-label="Categorías">
        {menu.categories.map((category) => <a key={category.id} href={`#category-${category.id}`}>{category.name}</a>)}
      </nav>
      {menu.categories.map((category) => (
        <section id={`category-${category.id}`} className="menu-category" key={category.id}>
          <h2>{category.name}</h2>
          <div className="menu-product-list">
            {category.products.map((product) => <ProductCard key={product.id} product={product} onSelect={setSelectedProduct} />)}
          </div>
        </section>
      ))}
      {message && <p className="login-error menu-message" role="alert">{message}</p>}
      {cart.length > 0 && (
        <button className="sticky-cart" type="button" onClick={() => setCartOpen(true)}>
          <span>{cart.reduce((count, item) => count + item.quantity, 0)} {cart.length === 1 ? "producto" : "productos"}</span>
          <strong>{formatPrice(total)}</strong><span>{canOrder ? "Ver pedido" : "Ver selección"}</span>
        </button>
      )}
      {selectedProduct && <ProductDialog product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(item) => setCart((current) => addToCart(current, item))} />}
      {cartOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <section className="cart-dialog" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <button className="dialog-close" type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar">×</button>
            <p className="eyebrow">Tu selección</p><h2 id="cart-title">El pedido de {menu.table.label}</h2>
            <ul className="cart-lines">
              {cart.map((item, index) => {
                const product = products.get(item.productId);
                return <li key={`${item.productId}-${index}`}>
                  <div><strong>{item.quantity} × {product?.name ?? "Producto"}</strong>
                    {item.optionIds.map((id) => <span className="cart-line-detail" key={id}>{product?.optionGroups.flatMap((group) => group.values).find((value) => value.id === id)?.name}</span>)}
                    {item.notes && <span className="cart-line-detail">Nota: {item.notes}</span>}
                  </div>
                  <div className="cart-line-actions"><strong>{formatPrice(item.displayedTotalCents * item.quantity)}</strong>
                    <button type="button" aria-label={`Quitar una porción de ${product?.name ?? "producto"}`} onClick={() => setCart((current) => current.flatMap((line, lineIndex) => lineIndex !== index ? [line] : line.quantity > 1 ? [{ ...line, quantity: line.quantity - 1 }] : []))}>−</button>
                    <button type="button" aria-label={`Agregar una porción de ${product?.name ?? "producto"}`} onClick={() => setCart((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line))}>＋</button>
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
