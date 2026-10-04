import { Hamburger, Minus, Plus } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import { formatArs } from "@/lib/format";
import type { MenuProduct } from "./product-dialog";

export { formatArs };

export function ProductCard({ product, onSelect }: { product: MenuProduct; onSelect: (product: MenuProduct) => void }) {
  return (
    // The whole card opens the product; the button stays as the keyboard and screen-reader target.
    <article className={`cm-product${product.available ? "" : " is-unavailable"}`} onClick={() => { if (product.available) onSelect(product); }}>
      <div className="cm-product-copy">
        <h3>{product.name}</h3>
        {product.description && <p className="cm-product-desc">{product.description}</p>}
        <div className="cm-product-meta">
          <span className="cm-product-price">{formatArs(product.priceCents)}</span>
          {product.optionGroups.length > 0 && <span className="cm-tag">Personalizable</span>}
          {!product.available && <span className="cm-tag is-warn">Agotado</span>}
          {product.available && product.stockLeft ? <span className="cm-tag is-warn">{product.stockLeft === 1 ? "Última unidad" : `Últimas ${product.stockLeft}`}</span> : null}
        </div>
      </div>
      <div className="cm-product-media">
        {product.imageUrl ? (
          <Image className="cm-product-image" src={product.imageUrl} alt="" width={112} height={112} unoptimized />
        ) : <div className="cm-product-image-placeholder" aria-hidden="true"><Hamburger size={36} weight="duotone" /></div>}
        <button
          className="cm-add"
          type="button"
          disabled={!product.available}
          onClick={(event) => { event.stopPropagation(); onSelect(product); }}
          aria-label={product.available ? `Agregar ${product.name}` : `${product.name}, agotado`}
        >
          {product.available ? <Plus size={20} weight="bold" aria-hidden="true" /> : <Minus size={20} weight="bold" aria-hidden="true" />}
        </button>
      </div>
    </article>
  );
}
