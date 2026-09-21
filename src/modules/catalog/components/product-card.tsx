import Image from "next/image";
import type { MenuProduct } from "./product-dialog";

export function formatArs(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
    .format(cents / 100);
}

export function ProductCard({ product, onSelect }: { product: MenuProduct & { imageUrl?: string | null }; onSelect: (product: MenuProduct) => void }) {
  return (
    <article className={`menu-product${product.available ? "" : " is-unavailable"}`}>
      {product.imageUrl ? (
        <Image className="menu-product-image" src={product.imageUrl} alt="" width={104} height={104} unoptimized />
      ) : <div className="menu-product-image-placeholder" aria-hidden="true">🍽️</div>}
      <div className="menu-product-copy">
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
        <span className="menu-product-price">{formatArs(product.priceCents)}</span>
      </div>
      <button
        className="menu-add-button"
        type="button"
        disabled={!product.available}
        onClick={() => onSelect(product)}
        aria-label={product.available ? `Agregar ${product.name}` : `${product.name}, agotado`}
      >
        {product.available ? "＋" : "Agotado"}
      </button>
    </article>
  );
}
