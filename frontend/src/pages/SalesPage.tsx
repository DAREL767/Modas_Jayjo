import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/endpoints";
import type { Product, Sale } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, ErrorNotice, formatCop, Notice, Panel } from "../components/Panel";

export function SalesPage() {
  const { accessToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [cashReceived, setCashReceived] = useState(0);
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const idempotencyKey = useRef<string | null>(null);

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

  const cart = products.flatMap((product) => {
    const quantity = quantities[product.id] ?? 0;
    return quantity > 0 ? [{ product, quantity }] : [];
  });
  const total = cart.reduce((sum, item) => sum + item.product.unit_price_cop * item.quantity, 0);

  const changeQuantity = (product: Product, next: number) => {
    setSale(null);
    idempotencyKey.current = null;
    setQuantities((current) => {
      const quantity = Math.max(0, Math.min(product.stock_quantity, next));
      const updated = { ...current };
      if (quantity === 0) delete updated[product.id];
      else updated[product.id] = quantity;
      return updated;
    });
  };

  const checkout = async () => {
    if (!accessToken || cart.length === 0) return;
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
      setQuantities({});
      setCashReceived(0);
      idempotencyKey.current = null;
      await reloadProducts();
    } catch (caught) {
      setError(caught);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
      <Panel title="Punto de venta" description="Los precios y la disponibilidad se validan nuevamente al confirmar.">
        <div className="space-y-4">
          {error !== null && <ErrorNotice error={error} />}
          {sale && <Notice tone="success">Venta registrada · {sale.sale_id} · Total {formatCop(sale.total_cop)}</Notice>}
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Cargando prendas…</p> : products.filter((product) => product.is_active && product.stock_quantity > 0).length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No hay prendas disponibles para vender.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {products.filter((product) => product.is_active && product.stock_quantity > 0).map((product) => (
                <article key={product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.sku} · {product.size} · {product.color}</p><p className="mt-2 text-sm font-bold text-blue-700">{formatCop(product.unit_price_cop)}</p><p className="mt-1 text-xs text-slate-400">Disponibles: {product.stock_quantity}</p></div>
                  <div className="flex items-center gap-2"><Button className="size-9 min-h-9 px-0" variant="secondary" aria-label={`Quitar ${product.name}`} onClick={() => changeQuantity(product, (quantities[product.id] ?? 0) - 1)}>−</Button><span className="w-5 text-center text-sm font-bold">{quantities[product.id] ?? 0}</span><Button className="size-9 min-h-9 px-0" aria-label={`Agregar ${product.name}`} disabled={(quantities[product.id] ?? 0) >= product.stock_quantity} onClick={() => changeQuantity(product, (quantities[product.id] ?? 0) + 1)}>+</Button></div>
                </article>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Cobro" description={`${cart.reduce((sum, item) => sum + item.quantity, 0)} unidades en el carrito`}>
        <div className="space-y-4">
          {cart.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Agrega prendas para comenzar una venta.</p> : cart.map(({ product, quantity }) => <div key={product.id} className="flex justify-between gap-3 border-b border-slate-100 pb-3 text-sm"><span>{quantity} × {product.name}</span><span className="font-semibold">{formatCop(quantity * product.unit_price_cop)}</span></div>)}
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Efectivo recibido (COP)<input className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5" type="number" min={total} max={2_000_000_000} step="1" value={cashReceived || ""} onChange={(event) => { setCashReceived(Number(event.target.value)); idempotencyKey.current = null; }} required /></label>
          <div className="flex items-center justify-between rounded-xl bg-blue-50 p-3 text-sm"><span>Cambio</span><strong>{formatCop(Math.max(cashReceived - total, 0))}</strong></div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-4"><span className="text-sm font-medium text-slate-500">Total estimado</span><strong className="text-xl text-slate-950">{formatCop(total)}</strong></div>
          <Button className="w-full" disabled={working || cart.length === 0 || loading || cashReceived < total} onClick={() => void checkout()}>{working ? "Procesando…" : "Confirmar venta"}</Button>
          <p className="text-xs leading-5 text-slate-400">Si la conexión falla al confirmar, puedes reintentar con seguridad: se usa la misma clave de idempotencia.</p>
        </div>
      </Panel>
    </div>
  );
}
