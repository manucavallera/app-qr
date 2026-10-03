import Image from "next/image";
import { formatArs } from "@/lib/format";
import type { MenuProduct } from "./product-dialog";

export { formatArs };

export function ProductCard({ product, onSelect }: { product: MenuProduct; onSelect: (product: MenuProduct) => void }) {
  return (
    // The whole card opens the product; the button stays as the keyboard and screen-reader target.
    <article className={`menu-product${product.available ? "" : " is-unavailable"}`} onClick={() => { if (product.available) onSelect(product); }}>
      {product.imageUrl ? (
        <Image className="menu-product-image" src={product.imageUrl} alt="" width={104} height={104} unoptimized />
      ) : <div className="menu-product-image-placeholder" aria-hidden="true"><span>Menú</span></div>}
      <div className="menu-product-copy">
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
        <div className="menu-product-meta"><span className="menu-product-price">{formatArs(product.priceCents)}</span>{product.optionGroups.length > 0 && <span className="menu-product-options">Personalizable</span>}{!product.available && <span className="menu-product-stock">Agotado</span>}{product.available && product.stockLeft ? <span className="menu-product-stock">{product.stockLeft === 1 ? "Última unidad" : `Últimas ${product.stockLeft}`}</span> : null}</div>
      </div>
      <button
        className="menu-add-button"
        type="button"
        disabled={!product.available}
        onClick={(event) => { event.stopPropagation(); onSelect(product); }}
        aria-label={product.available ? `Agregar ${product.name}` : `${product.name}, agotado`}
      >
        {product.available ? "+" : "–"}
      </button>
    </article>
  );
}
