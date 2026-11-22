import { useEffect, useRef, useState } from "react";
import { api } from "../../api/endpoints";
import type { Product } from "../../api/types";
import { Button, Field, formatCop } from "../../components/Panel";
import { CameraScanButton } from "../../components/CameraScanner";
import type { CartItem, saleAmounts } from "./amounts";

function CartPhoto({ productId, accessToken }: { productId: string; accessToken: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void api.productPhoto(accessToken, productId, controller.signal)
      .then(({ photo }) => { if (!controller.signal.aborted) setPhoto(photo); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [accessToken, productId]);
  return photo ? <img className="sale-garment-photo" src={photo} alt="" /> : <span className="sale-garment-icon" aria-hidden="true">👕</span>;
}

export function SaleCatalogStep({
  products, cart, search, onSearchChange, onAdd, onRemove, onContinue, onDiscount, amounts, accessToken,
}: {
  products: Product[];
  accessToken: string | null;
  cart: CartItem[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (product: Product) => void;
  onRemove: (product: Product) => void;
  onContinue: () => void;
  onDiscount: (product: Product) => void;
  amounts: ReturnType<typeof saleAmounts>;
}) {
  const searchInput = useRef<HTMLInputElement>(null);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  const normalizedSearch = normalize(search);
  const available = products.filter((product) => product.is_active && product.stock_quantity > 0);
  const exactCode = available.find((product) => product.sku.toUpperCase() === search.trim().toUpperCase());
  const matches = normalizedSearch
    ? (exactCode ? [exactCode] : available.filter((product) => {
        const text = normalize([product.name, product.sku, product.category, product.size, product.color].join(" "));
        return normalizedSearch.split(/\s+/).every((term) => text.includes(term));
      }))
    : [];
  const remaining = (product: Product) => product.stock_quantity - (cart.find((item) => item.product.id === product.id)?.quantity ?? 0);
  const add = (product: Product) => {
    if (remaining(product) <= 0) return;
    onAdd(product);
    onSearchChange("");
    searchInput.current?.focus();
  };

  return (
    <section className="sale-card">
      <div className="sale-workspace">
        <div className="sale-search-column">
          <Field ref={searchInput} label="Buscar por nombre o código" placeholder="Nombre, variante o código / número de serie (SKU)" value={search} onChange={(event) => onSearchChange(event.target.value)} onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (exactCode) add(exactCode);
          }} autoComplete="off" autoFocus />
          <p className="sale-search-hint">Selecciona la variante correcta para agregarla al carrito.</p>
          <CameraScanButton onDetected={onSearchChange} />
          {normalizedSearch && (
            <div className="sale-search-results" role="list" aria-label="Prendas encontradas">
              {matches.length === 0 ? <p className="sale-no-results">No encontramos prendas disponibles con esa búsqueda.</p> : matches.map((product) => (
                <article className="sale-product-result" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.sku} · Talla {product.size} · {product.color}</span>
                    <span className="sale-product-stock">Disponibles: {remaining(product)}</span>
                  </div>
                  <div className="sale-result-action">
                    <strong>{formatCop(product.unit_price_cop)}</strong>
                    <Button className="sale-add-button" disabled={remaining(product) <= 0} onClick={() => add(product)}>Agregar</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <div className="sale-cart-column">
          <h2 className="sale-section-title">Carrito de compras <span>({cart.length})</span></h2>
          <div className="sale-cart-list" aria-live="polite">
            {cart.length === 0 ? (
              <p className="sale-empty-cart">Agrega prendas para iniciar la venta.</p>
            ) : cart.map(({ product, quantity, unitDiscountCop }) => (
              <article className="sale-cart-item" key={product.id}>
                {product.has_photo && accessToken
                  ? <CartPhoto productId={product.id} accessToken={accessToken} />
                  : <span className="sale-garment-icon" aria-hidden="true">👕</span>}
                <div className="sale-cart-description">
                  <strong>{product.name}</strong>
                  <span>{product.size} · {product.color} · {formatCop(product.unit_price_cop)}</span>
                  <button type="button" className="sale-discount-button" onClick={() => onDiscount(product)}>Descuento de {product.name}: {formatCop(unitDiscountCop)} / unidad</button>
                  <span>Total: {formatCop((product.unit_price_cop - unitDiscountCop) * quantity)}</span>
                </div>
                <div className="sale-quantity-control" aria-label={"Cantidad de " + product.name}>
                  <button type="button" aria-label={"Quitar una unidad de " + product.name} onClick={() => onRemove(product)}>−</button>
                  <span>{quantity}</span>
                  <button type="button" aria-label={"Agregar una unidad de " + product.name} disabled={quantity >= product.stock_quantity} onClick={() => onAdd(product)}>+</button>
                </div>
              </article>
            ))}
          </div>
          <div className="sale-discount-summary">
            <h3 className="sale-section-title">Resumen de la venta</h3>
            <dl><div><dt>Subtotal</dt><dd>{formatCop(amounts.subtotal)}</dd></div><div><dt>Descuentos</dt><dd>− {formatCop(amounts.discount)}</dd></div><div><dt>Total a pagar</dt><dd>{formatCop(amounts.total)}</dd></div></dl>
          </div>
          <div className="sale-card-footer">
            <Button className="sale-continue-button" disabled={cart.length === 0} onClick={onContinue}>Proceder al cobro</Button>
          </div>
        </div>

      </div>
    </section>
  );
}
