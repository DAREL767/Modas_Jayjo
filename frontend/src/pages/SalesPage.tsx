import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/endpoints";
import type { Product, Sale } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, ErrorNotice, formatCop, Notice } from "../components/Panel";

type SaleStep = "cart" | "payment" | "success";

const QUICK_BILLS = [20_000, 50_000, 100_000];

function formatMoney(value: number): string {
  return `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)}`;
}

export function SalesPage({ onBack }: { onBack: () => void }) {
  const { accessToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [cashReceived, setCashReceived] = useState(0);
  const [sale, setSale] = useState<Sale | null>(null);
  const [step, setStep] = useState<SaleStep>("cart");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const idempotencyKey = useRef<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const reloadProducts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setProducts(await api.inventory(accessToken));
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void reloadProducts(); }, [reloadProducts]);

  const availableProducts = useMemo(
    () => products.filter((product) => product.is_active && product.stock_quantity > 0),
    [products],
  );
  const cart = availableProducts.flatMap((product) => {
    const quantity = quantities[product.id] ?? 0;
    return quantity > 0 ? [{ product, quantity }] : [];
  });
  const total = cart.reduce((sum, item) => sum + item.product.unit_price_cop * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const change = Math.max(cashReceived - total, 0);

  const searchResults = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    if (!term) return [];
    return availableProducts
      .filter((product) =>
        `${product.name} ${product.sku} ${product.category} ${product.size} ${product.color}`
          .toLocaleLowerCase("es")
          .includes(term),
      )
      .slice(0, 6);
  }, [availableProducts, search]);

  const changeQuantity = (product: Product, next: number) => {
    idempotencyKey.current = null;
    setSale(null);
    setQuantities((current) => {
      const quantity = Math.max(0, Math.min(product.stock_quantity, next));
      const updated = { ...current };
      if (quantity === 0) delete updated[product.id];
      else updated[product.id] = quantity;
      return updated;
    });
  };

  const addProduct = (product: Product) => {
    changeQuantity(product, (quantities[product.id] ?? 0) + 1);
    setSearch("");
    searchInput.current?.focus();
  };

  const selectExactSearchResult = () => {
    const term = search.trim().toLocaleLowerCase("es");
    const exactMatch = availableProducts.find(
      (product) => product.sku.toLocaleLowerCase("es") === term,
    );
    if (exactMatch) addProduct(exactMatch);
  };

  const checkout = async () => {
    if (!accessToken || cart.length === 0 || cashReceived < total) return;
    setWorking(true);
    setError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const completed = await api.createSale(
        accessToken,
        {
          items: cart.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
          cash_received_cop: cashReceived,
        },
        idempotencyKey.current,
      );
      setSale(completed);
      setStep("success");
      setQuantities({});
      await reloadProducts();
    } catch (caught) {
      setError(caught);
    } finally {
      setWorking(false);
    }
  };

  const finishSale = () => {
    setSale(null);
    setCashReceived(0);
    setSearch("");
    idempotencyKey.current = null;
    setStep("cart");
    onBack();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Button
          variant="secondary"
          className="min-h-9 justify-self-start rounded-full border-slate-900 px-5 text-xs text-slate-900"
          onClick={() => step === "payment" ? setStep("cart") : onBack()}
        >
          {step === "payment" ? "‹ Cancelar / Volver" : "‹ Volver"}
        </Button>
        <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {step === "cart" ? "Nueva Venta" : "Procesar Pago"}
        </h1>
        <span className="justify-self-end text-sm font-medium text-slate-700"><span className="mr-2 inline-block size-3 rounded-full bg-lime-500 align-middle" />Activo</span>
      </header>

      <section className="relative min-h-[420px] rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_22px_60px_-40px_rgba(15,23,42,0.45)] sm:p-8">
        {error !== null && <div className="mb-5"><ErrorNotice error={error} /></div>}
        {step === "cart" && (
          <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex min-w-0 flex-col">
              <h2 className="mb-3 text-lg font-bold text-slate-950">Carrito de Compras ({itemCount})</h2>

              <label className="mb-2 text-sm font-medium text-slate-700" htmlFor="product-search">
                Buscar prenda por código o nombre
              </label>
              <div className="relative">
                <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100">
                  <span aria-hidden="true" className="text-slate-400">⌕</span>
                  <input
                    ref={searchInput}
                    id="product-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); selectExactSearchResult(); } }}
                    placeholder="Ej. 770123456789 o Chaqueta Jean"
                    autoComplete="off"
                    className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                  {search && <button type="button" className="text-sm text-slate-400 hover:text-slate-700" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">×</button>}
                </div>
                {search.trim() && (
                  <div className="absolute inset-x-0 top-full z-10 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    {searchResults.length ? searchResults.map((product) => (
                      <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-500">
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{product.name}</span><span className="block text-xs text-slate-500">{product.sku} · Talla {product.size} · {product.color} · Stock {product.stock_quantity}</span></span>
                        <span className="shrink-0 text-sm font-semibold text-slate-700">{formatCop(product.unit_price_cop)}</span>
                      </button>
                    )) : <p className="px-3 py-4 text-center text-sm text-slate-500">No hay prendas disponibles con ese código o nombre.</p>}
                  </div>
                )}
              </div>

              <div className="mt-4 flex-1 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                {loading ? <p className="py-8 text-center text-sm text-slate-500">Cargando inventario…</p> : cart.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">Busca y selecciona una prenda para agregarla a la venta.</p>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {cart.map(({ product, quantity }) => (
                      <li key={product.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-100 text-lg" aria-hidden="true">👕</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{product.name} <span className="text-slate-500">({product.size})</span></p>
                          <p className="text-xs text-slate-500">{formatCop(product.unit_price_cop)} · {product.color}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" aria-label={`Quitar una unidad de ${product.name}`} className="grid size-8 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100" onClick={() => changeQuantity(product, quantity - 1)}>−</button>
                          <span className="w-5 text-center text-sm font-semibold">{quantity}</span>
                          <button type="button" aria-label={`Agregar una unidad de ${product.name}`} disabled={quantity >= product.stock_quantity} className="grid size-8 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40" onClick={() => changeQuantity(product, quantity + 1)}>+</button>
                        </div>
                        <button type="button" aria-label={`Eliminar ${product.name} del carrito`} className="ml-1 text-lg text-sky-700 hover:text-rose-600" onClick={() => changeQuantity(product, 0)}>▤</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-600">Total de la venta</span>
                <strong className="rounded-md bg-sky-100 px-3 py-1.5 text-lg text-slate-950">{formatMoney(total)}</strong>
              </div>
            </div>

            <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl bg-slate-50 p-6 text-center">
              <div className="mb-4 grid size-24 place-items-center rounded-2xl border border-slate-200 bg-white text-4xl" aria-hidden="true">▥</div>
              <p className="font-semibold text-slate-800">Escáner de prendas</p>
              <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500">Usa el lector de códigos conectado o busca manualmente por código o nombre.</p>
            </div>

            <div className="lg:col-span-2 flex justify-center">
              <Button className="min-w-52 rounded-full border border-slate-900 bg-sky-200 text-slate-950 hover:bg-sky-300" disabled={cart.length === 0 || loading} onClick={() => { setError(null); setStep("payment"); }}>
                Proceder al Cobro
              </Button>
            </div>
          </div>
        )}

        {step === "payment" && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-5 flex items-center justify-center gap-8 border-b-2 border-slate-900 pb-2 text-xl font-bold text-slate-600 sm:text-2xl">
              <span>Total a Pagar</span><span>{formatMoney(total)}</span>
            </div>
            <label htmlFor="cash-received" className="block text-base font-medium text-slate-900">Efectivo Recibido:</label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button type="button" className="min-h-11 rounded-full border border-slate-300 px-4 text-sm hover:bg-sky-50" onClick={() => setCashReceived(total)}>Exacto ({formatMoney(total)})</button>
              <label className="flex min-h-11 items-center rounded-full border border-slate-300 px-4 focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100"><span className="mr-3 text-slate-500">$</span><input id="cash-received" type="number" inputMode="numeric" min={total} max={2_000_000_000} step="1" value={cashReceived || ""} onChange={(event) => { setCashReceived(Number(event.target.value)); idempotencyKey.current = null; }} placeholder="0" className="w-full bg-transparent text-right outline-none" required /></label>
            </div>
            <p className="mb-3 mt-5 text-base font-medium text-slate-900">Billetes Rápidos:</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {QUICK_BILLS.map((bill) => <button key={bill} type="button" className="min-h-11 rounded-full border border-slate-300 px-4 text-sm hover:bg-sky-50" onClick={() => setCashReceived(bill)}>{formatMoney(bill)}</button>)}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-base font-medium text-slate-900 sm:gap-6">
              <span>CAMBIO A ENTREGAR:</span>
              <strong className="min-w-48 rounded-full border border-sky-500 bg-slate-50 px-5 py-2 text-center font-semibold shadow-md">{formatMoney(change)}</strong>
            </div>
            <div className="mt-8 flex justify-center">
              <Button className="min-w-52 rounded-full border border-slate-900 bg-sky-200 text-slate-950 hover:bg-sky-300" disabled={working || cart.length === 0 || cashReceived < total} onClick={() => void checkout()}>
                {working ? "Registrando venta…" : "✓ Confirmar Venta"}
              </Button>
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">El cobro se registra en efectivo y el stock se actualiza al confirmar.</p>
          </div>
        )}

        {step === "success" && sale && (
          <div className="absolute inset-5 z-10 grid place-items-center rounded-[1.5rem] bg-slate-900/85 p-4 sm:inset-8 sm:rounded-[2rem]" role="dialog" aria-modal="true" aria-labelledby="sale-success-title">
            <div className="w-full max-w-md text-center text-white">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-green-500 text-4xl font-bold text-green-950" aria-hidden="true">✓</span>
              <h2 id="sale-success-title" className="mt-4 text-2xl font-bold">¡Venta Registrada!</h2>
              <div className="mt-5 space-y-2 text-sm sm:text-base">
                <p className="font-semibold">Detalles:</p>
                <p>Total: {formatCop(sale.total_cop)}</p>
                <p>Devuelta: {formatCop(sale.change_cop)}</p>
                <p className="text-xs text-slate-300">Venta {sale.sale_id}</p>
              </div>
              <Button className="mt-6 rounded-full border border-slate-900 bg-sky-200 text-slate-950 hover:bg-sky-300" onClick={finishSale}>Finalizar y Volver al Menú</Button>
            </div>
          </div>
        )}
      </section>

      {error !== null && step === "success" && <div className="mt-4"><Notice>La venta se registró, pero no se pudo actualizar el inventario en pantalla. Puedes continuar y revisar el inventario.</Notice></div>}
    </div>
  );
}
