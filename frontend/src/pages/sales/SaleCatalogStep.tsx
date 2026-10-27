import type { Product } from "../../api/types";
import { Button, Field, formatCop } from "../../components/Panel";

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
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const matches = normalizedSearch
    ? products.filter((product) => product.is_active && product.stock_quantity > 0)
        .filter((product) => (product.name + " " + product.sku + " " + product.category + " " + product.size + " " + product.color).toLocaleLowerCase("es").includes(normalizedSearch))
        .slice(0, 6)
    : [];
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
          <Field label="Buscar por nombre o código" placeholder="Escribe el nombre o escanea el código de barras" value={search} onChange={(event) => onSearchChange(event.target.value)} autoComplete="off" autoFocus />
          <p className="sale-search-hint">Selecciona la variante correcta para agregarla al carrito.</p>
          {normalizedSearch && (
            <div className="sale-search-results" role="list" aria-label="Prendas encontradas">
              {matches.length === 0 ? <p className="sale-no-results">No encontramos prendas disponibles con esa búsqueda.</p> : matches.map((product) => (
                <article className="sale-product-result" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.sku} · Talla {product.size} · {product.color}</span>
                    <span className="sale-product-stock">Disponibles: {product.stock_quantity}</span>
                  </div>
                  <div className="sale-result-action">
                    <strong>{formatCop(product.unit_price_cop)}</strong>
                    <Button className="sale-add-button" onClick={() => onAdd(product)}>Agregar</Button>
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
