"use client";

import { Check, Hamburger, Minus, Plus, ShoppingBag, X } from "@phosphor-icons/react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { ProductDialog, type MenuProduct } from "@/modules/catalog/components/product-dialog";
import { addToCart, canPersistCart, cartTotal, clearCart, loadCart, removeCartItem, replaceCartItem, saveCart, type CartItem } from "@/modules/orders/cart-store";
import { formatArs as formatPrice } from "@/lib/format";
import { useEscapeKey } from "@/lib/client/use-escape-key";
import { MenuHeader, type PublicBusiness } from "./menu-header";

type PublicMenu = Readonly<{
  table: { label: string };
  mode: "QR_OPEN" | "COUNTER_ONLY" | "PAUSED";
  business: PublicBusiness;
  service: { mode: "QR_OPEN" | "COUNTER_ONLY" | "PAUSED"; hoursLabel: string | null };
  categories: ReadonlyArray<{ id: string; name: string; products: ReadonlyArray<MenuProduct> }>;
  serverTime: string;
}>;

const noop = () => undefined;

type SessionStatus = "checking" | "needs-name" | "starting" | "ready" | "error";

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
  const [addedNotice, setAddedNotice] = useState<{ id: number; name: string } | null>(null);
  const categoryNav = useRef<HTMLElement>(null);

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

  useEffect(() => {
    if (!addedNotice) return;
    const timer = window.setTimeout(() => setAddedNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [addedNotice]);

  useEffect(() => {
    if (!menu || cartLoadedForToken !== qrToken) return;
    const catalog = new Map(menu.categories.flatMap((category) => category.products.map((product) => [product.id, product] as const)));
    const valid = (item: CartItem) => {
      const product = catalog.get(item.productId);
      if (!product?.available) return false;
      const values = new Map(product.optionGroups.flatMap((group) => group.values.map((value) => [value.id, value] as const)));
      return item.optionIds.every((id) => values.get(id)?.available !== false && values.has(id));
    };
    const kept = cart.filter(valid);
    if (kept.length === cart.length) return;
    const timer = window.setTimeout(() => {
      setCart(kept);
      setMessage("Sacamos de tu pedido productos que ya no están disponibles.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [menu, cart, cartLoadedForToken, qrToken]);

  // Highlight the category on screen and keep its chip visible in the sticky bar.
  useEffect(() => {
    if (!menu || sessionStatus !== "ready") return;
    const sections = menu.categories.flatMap((category) => document.getElementById(`category-${category.id}`) ?? []);
    if (sections.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      const current = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (current) setActiveCategoryId(current.target.id.replace("category-", ""));
    }, { rootMargin: "-90px 0px -60% 0px" });
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [menu, sessionStatus]);

  // Scroll only the chip bar sideways. scrollIntoView would also move the page and cut a fast scroll short.
  useEffect(() => {
    const nav = categoryNav.current;
    const chip = activeCategoryId ? document.getElementById(`category-chip-${activeCategoryId}`) : null;
    if (!nav || !chip) return;
    nav.scrollTo({ left: chip.offsetLeft - (nav.clientWidth - chip.clientWidth) / 2, behavior: "smooth" });
  }, [activeCategoryId]);

  const closeCart = useCallback(() => setCartOpen(false), []);
  useEscapeKey(cartOpen ? closeCart : noop);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const itemCount = useMemo(() => cart.reduce((count, item) => count + item.quantity, 0), [cart]);
  const products = useMemo(() => new Map(menu?.categories.flatMap((category) => category.products.map((product) => [product.id, product] as const)) ?? []), [menu]);
  const featured = useMemo(() => menu?.categories.flatMap((category) => category.products).filter((product) => product.featured && product.available) ?? [], [menu]);

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
    return (
      <main className="cm-shell" aria-busy="true" aria-live="polite">
        <span className="cm-sr-only">Abriendo la carta…</span>
        <div className="cm-skel cm-skel-brand" />
        <div className="cm-skel cm-skel-hero" />
        <div className="cm-skel cm-skel-chips" />
        {[0, 1, 2, 3].map((index) => <div className="cm-skel cm-skel-row" key={index} />)}
      </main>
    );
  }

  if (sessionStatus === "error") {
    return (
      <main className="cm-welcome-shell">
        <section className="cm-welcome">
          <h1>La carta no cargó</h1>
          <p>{message}</p>
          <button className="cm-btn" type="button" onClick={() => { setMessage(null); setSessionStatus("checking"); void checkSession(); }}>Reintentar</button>
        </section>
      </main>
    );
  }

  if (sessionStatus === "needs-name" || sessionStatus === "starting") {
    const starting = sessionStatus === "starting";
    return (
      <main className="cm-welcome-shell">
        <section className="cm-welcome">
          <h1>¿Cómo te llamamos?</h1>
          <p>Así podemos identificar tus pedidos cuando pidas en el bar.</p>
          <form onSubmit={startSession}>
            <label className="cm-field" htmlFor="customer-nickname">Tu nombre o apodo
              <input id="customer-nickname" className="cm-input" autoComplete="nickname" autoFocus disabled={starting} minLength={1} maxLength={40} value={nickname} onChange={(event) => setNickname(event.target.value)} required />
            </label>
            {message && <p className="cm-error" role="alert">{message}</p>}
            <button className="cm-btn" type="submit" disabled={starting}>{starting ? "Abriendo…" : "Ver la carta"}</button>
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
    if (editingCartIndex === null) setAddedNotice({ id: Date.now(), name: products.get(item.productId)?.name ?? "Producto" });
    closeProductDialog();
  }

  function clearCurrentCart() {
    clearCart(qrToken);
    setCart([]);
    setCartOpen(false);
  }

  return (
    <main className={`cm-shell${itemCount > 0 ? " has-cartbar" : ""}`}>
      {addedNotice && (
        <div key={addedNotice.id} className="cm-toast" role="status">
          <span><Check size={18} weight="bold" aria-hidden="true" />{addedNotice.name} agregado</span>
          <button type="button" onClick={() => { setAddedNotice(null); setCartOpen(true); }}>Ver pedido</button>
        </div>
      )}
      <MenuHeader business={menu.business} hoursLabel={menu.service.hoursLabel} />
      <header className="cm-hero">
        <div className="cm-hero-meta"><span className="cm-table">{menu.table.label}</span><span className="cm-greeting">Hola, {nickname}</span></div>
        <h1>Elegí algo rico.</h1>
        <p>Todo lo que sale de la cocina, directo a tu mesa.</p>
      </header>
      {!canOrder && <aside className="cm-notice" role="status">{modeMessage}</aside>}
      {featured.length > 0 && (
        <section className="cm-featured" aria-labelledby="featured-title">
          <h2 id="featured-title">Recomendados</h2>
          <div className="cm-featured-row">
            {featured.map((product) => (
              <button className="cm-featured-card" key={product.id} type="button" onClick={() => setSelectedProduct(product)} aria-label={`Ver ${product.name}`}>
                {product.imageUrl ? <Image src={product.imageUrl} alt="" width={156} height={156} loading="eager" unoptimized /> : <span className="cm-featured-placeholder" aria-hidden="true"><Hamburger size={40} weight="duotone" /></span>}
                <strong>{product.name}</strong>
                <span>{formatPrice(product.priceCents)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="cm-toolbar">
        <nav className="cm-chips" aria-label="Categorías" ref={categoryNav}>
          {menu.categories.map((category) => <button className={`cm-chip${activeCategoryId === category.id ? " is-active" : ""}`} id={`category-chip-${category.id}`} key={category.id} type="button" aria-current={activeCategoryId === category.id ? "true" : undefined} onClick={() => document.getElementById(`category-${category.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{category.name}</button>)}
        </nav>
        {itemCount === 0 && (
          <button className="cm-cart-icon" type="button" aria-label="Ver pedido, 0 productos" onClick={() => setCartOpen(true)}>
            <ShoppingBag size={22} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>
      {menu.categories.map((category) => (
        <section id={`category-${category.id}`} className="cm-category" key={category.id}>
          <div className="cm-category-head"><h2>{category.name}</h2><span>{category.products.length} opciones</span></div>
          <div className="cm-product-list">
            {category.products.map((product) => <ProductCard key={product.id} product={product} onSelect={setSelectedProduct} />)}
          </div>
        </section>
      ))}
      {menu.categories.length === 0 && <p className="cm-empty">Todavía no hay productos publicados en la carta.</p>}
      {message && <p className="cm-error" role="alert">{message}</p>}
      {itemCount > 0 && (
        <button className="cm-cartbar" type="button" aria-label={`Ver pedido, ${itemCount} ${itemCount === 1 ? "producto" : "productos"}`} onClick={() => setCartOpen(true)}>
          <span className="cm-cartbar-label"><ShoppingBag size={22} weight="bold" aria-hidden="true" />Ver pedido<span key={itemCount} className="cm-count">{itemCount}</span></span>
          <span className="cm-cartbar-total">{formatPrice(total)}</span>
        </button>
      )}
      {selectedProduct && <ProductDialog product={selectedProduct} initialItem={editingCartIndex === null ? undefined : cart[editingCartIndex]} onClose={closeProductDialog} onAdd={saveProduct} />}
      {cartOpen && (
        <div className="cm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <section className="cm-sheet" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <button className="cm-close" type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar"><X size={20} weight="bold" aria-hidden="true" /></button>
            <div className="cm-sheet-body">
              <h2 id="cart-title">El pedido de {menu.table.label}</h2>
              <ul className="cm-lines">
                {cart.map((item, index) => {
                  const product = products.get(item.productId);
                  return <li className="cm-line" key={`${item.productId}-${index}`}>
                    <div className="cm-line-main"><strong>{item.quantity} × {product?.name ?? "Producto"}</strong><strong>{formatPrice(item.displayedTotalCents * item.quantity)}</strong></div>
                    {item.optionIds.map((id) => <span className="cm-line-detail" key={id}>{product?.optionGroups.flatMap((group) => group.values).find((value) => value.id === id)?.name}</span>)}
                    {item.notes && <span className="cm-line-detail">Nota: {item.notes}</span>}
                    <div className="cm-line-actions">
                      <div className="cm-stepper" aria-label={`Cantidad de ${product?.name ?? "producto"}`}>
                        <button type="button" aria-label={`Restar una porción de ${product?.name ?? "producto"}`} onClick={() => setCart((current) => current.flatMap((line, lineIndex) => lineIndex !== index ? [line] : line.quantity > 1 ? [{ ...line, quantity: line.quantity - 1 }] : []))}><Minus size={18} weight="bold" aria-hidden="true" /></button>
                        <span>{item.quantity}</span>
                        <button type="button" aria-label={`Agregar una porción de ${product?.name ?? "producto"}`} onClick={() => setCart((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line))}><Plus size={18} weight="bold" aria-hidden="true" /></button>
                      </div>
                      <div>
                        <button className="cm-btn-text" type="button" onClick={() => { if (!product) return; setEditingCartIndex(index); setSelectedProduct(product); setCartOpen(false); }}>Editar</button>
                        <button className="cm-btn-text" type="button" onClick={() => setCart((current) => removeCartItem(current, index))}>Quitar</button>
                      </div>
                    </div>
                  </li>;
                })}
              </ul>
              <div className="cm-total"><span>Total estimado</span><strong>{formatPrice(total)}</strong></div>
              <div className="cm-stack">
                {canOrder ? <a className="cm-btn" href={`/m/${encodeURIComponent(qrToken)}/checkout`}>Continuar con el pedido</a> : <p className="cm-note">Cuando quieras pedir, acercate a la barra o caja.</p>}
                <button className="cm-btn cm-btn-quiet" type="button" onClick={() => setCartOpen(false)}>Seguir agregando</button>
                <button className="cm-btn-text" type="button" onClick={clearCurrentCart}>Vaciar pedido</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
