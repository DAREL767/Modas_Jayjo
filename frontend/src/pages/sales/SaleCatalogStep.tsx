import { useRef } from "react";
import type { Product } from "../../api/types";
import { Button, Field, formatCop } from "../../components/Panel";
import { CameraScanButton } from "../../components/CameraScanner";

type CartItem = { product: Product; quantity: number };

export function SaleCatalogStep({
  products, cart, search, onSearchChange, onAdd, onRemove, onContinue,
}: {
  products: Product[];
  cart: CartItem[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: (product: Product) => void;
  onRemove: (product: Product) => void;
  onContinue: () => void;
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
  const total = cart.reduce((sum, item) => sum + item.product.unit_price_cop * item.quantity, 0);

  return (
    <section className="sale-card">
      <div className="sale-workspace">
        <div className="sale-cart-column">
          <h2 className="sale-section-title">Carrito de compras <span>({cart.length})</span></h2>
          <div className="sale-cart-list" aria-live="polite">
            {cart.length === 0 ? (
              <p className="sale-empty-cart">Agrega prendas para iniciar la venta.</p>
            ) : cart.map(({ product, quantity }) => (
              <article className="sale-cart-item" key={product.id}>
                <div className="sale-garment-icon" aria-hidden="true">👕</div>
                <div className="sale-cart-description">
                  <strong>{product.name}</strong>
                  <span>{product.size} · {product.color} · {formatCop(product.unit_price_cop)}</span>
                </div>
                <div className="sale-quantity-control" aria-label={"Cantidad de " + product.name}>
                  <button type="button" aria-label={"Quitar una unidad de " + product.name} onClick={() => onRemove(product)}>−</button>
                  <span>{quantity}</span>
                  <button type="button" aria-label={"Agregar una unidad de " + product.name} disabled={quantity >= product.stock_quantity} onClick={() => onAdd(product)}>+</button>
                </div>
              </article>
            ))}
          </div>
          <div className="sale-total-chip">TOTAL: {formatCop(total)}</div>
        </div>

        <div className="sale-search-column">
          <div className="sale-search-illustration" aria-hidden="true">
            <span>🏷️</span><span className="sale-scan-line" />
          </div>
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
      </div>
      <div className="sale-card-footer">
        <Button className="sale-continue-button" disabled={cart.length === 0} onClick={onContinue}>Proceder al cobro</Button>
      </div>
    </section>
  );
}
