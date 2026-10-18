import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/endpoints";
import type { Product, ProductCreate } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, ErrorNotice, Field, formatCop, Notice, Panel } from "../components/Panel";

const emptyProduct: ProductCreate = {
  sku: "",
  name: "",
  category: "",
  size: "",
  color: "",
  unit_price_cop: 0,
  unit_cost_cop: null,
  stock_quantity: 0,
  low_stock_threshold: 0,
};

export function InventoryPage() {
  const { accessToken, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<ProductCreate>(emptyProduct);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setProducts(await api.inventory(accessToken, !isAdmin));
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [accessToken, isAdmin]);

  useEffect(() => { void reload(); }, [reload]);

  const visibleProducts = products.filter((product) =>
    `${product.name} ${product.sku} ${product.category} ${product.color} ${product.size}`
      .toLocaleLowerCase("es")
      .includes(search.toLocaleLowerCase("es")),
  );

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;
    setWorking(true);
    setError(null);
    setNotice("");
    try {
      await api.createProduct(accessToken, draft);
      setDraft(emptyProduct);
      setNotice("La variante se guardó en el inventario.");
      await reload();
    } catch (caught) {
      setError(caught);
    } finally {
      setWorking(false);
    }
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !editing) return;
    setWorking(true);
    setError(null);
    try {
      await api.updateProduct(accessToken, editing.id, {
        sku: editing.sku,
        name: editing.name,
        category: editing.category,
        size: editing.size,
        color: editing.color,
        unit_price_cop: editing.unit_price_cop,
        unit_cost_cop: editing.unit_cost_cop,
        low_stock_threshold: editing.low_stock_threshold,
        is_active: editing.is_active,
      });
      setEditing(null);
      setNotice("Los cambios del producto se guardaron.");
      await reload();
    } catch (caught) {
      setError(caught);
    } finally {
      setWorking(false);
    }
  };

  const submitAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !adjusting) return;
    setWorking(true);
    setError(null);
    try {
      await api.adjustStock(accessToken, adjusting.id, delta, reason);
      setAdjusting(null);
      setDelta(1);
      setReason("");
      setNotice("El ajuste quedó registrado en el historial de existencias.");
      await reload();
    } catch (caught) {
      setError(caught);
    } finally {
      setWorking(false);
    }
  };

  const deactivate = async (product: Product) => {
    if (!accessToken || !window.confirm(`¿Desactivar ${product.name} (${product.sku})?`)) return;
    setWorking(true);
    setError(null);
    try {
      await api.updateProduct(accessToken, product.id, { is_active: false });
      setNotice("La prenda quedó desactivada. Las ventas históricas se conservan.");
      await reload();
    } catch (caught) {
      setError(caught);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Inventario de prendas" description="Cada registro representa una variante de talla y color.">
        <div className="space-y-4">
          <label className="block max-w-lg text-sm font-medium text-slate-700">
            Buscar por prenda, SKU, categoría o variante
            <input className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej. camiseta, CAM-001, azul" />
          </label>
          {error !== null && <ErrorNotice error={error} />}
          {notice && <Notice tone="success">{notice}</Notice>}
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Cargando inventario…</p> : visibleProducts.length === 0 ? <p className="rounded-2xl bg-slate-50 py-10 text-center text-sm text-slate-500">No hay prendas que coincidan con la búsqueda.</p> : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Prenda / SKU</th><th className="px-4 py-3">Variante</th><th className="px-4 py-3">Precio</th>{isAdmin && <th className="px-4 py-3">Costo</th>}<th className="px-4 py-3">Existencias</th>{isAdmin && <th className="px-4 py-3">Acciones</th>}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visibleProducts.map((product) => (
                    <tr key={product.id} className={!product.is_active ? "bg-slate-50 text-slate-400" : ""}>
                      <td className="px-4 py-3.5"><p className="font-semibold text-slate-900">{product.name}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{product.sku} · {product.category}</p>{!product.is_active && <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase">Inactiva</span>}</td>
                      <td className="px-4 py-3.5 text-slate-600">{product.size} · {product.color}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-800">{formatCop(product.unit_price_cop)}</td>
                      {isAdmin && <td className="px-4 py-3.5 text-slate-600">{product.unit_cost_cop == null ? "—" : formatCop(product.unit_cost_cop)}</td>}
                      <td className="px-4 py-3.5"><span className={`font-semibold ${product.stock_quantity <= product.low_stock_threshold ? "text-amber-700" : "text-slate-800"}`}>{product.stock_quantity}</span><span className="ml-2 text-xs text-slate-400">mín. {product.low_stock_threshold}</span></td>
                      {isAdmin && <td className="px-4 py-3.5"><div className="flex flex-wrap gap-2"><Button className="min-h-9 px-3 text-xs" variant="secondary" onClick={() => setEditing({ ...product })}>Editar</Button><Button className="min-h-9 px-3 text-xs" variant="secondary" onClick={() => setAdjusting(product)}>Ajustar</Button>{product.is_active && <Button className="min-h-9 px-3 text-xs" variant="danger" disabled={working} onClick={() => void deactivate(product)}>Desactivar</Button>}{isAdmin && !product.is_active && <Button className="min-h-9 px-3 text-xs" variant="secondary" onClick={() => void api.updateProduct(accessToken!, product.id, { is_active: true }).then(reload).catch(setError)}>Reactivar</Button>}</div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      {isAdmin && (
        <Panel title="Registrar variante" description="El stock inicial también queda registrado como movimiento de inventario.">
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={createProduct}>
            <Field label="SKU" value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value.toUpperCase() })} required />
            <Field label="Nombre" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
            <Field label="Categoría" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required />
            <Field label="Talla" value={draft.size} onChange={(event) => setDraft({ ...draft, size: event.target.value })} required />
            <Field label="Color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} required />
            <Field label="Precio (COP)" type="number" min="1" value={draft.unit_price_cop || ""} onChange={(event) => setDraft({ ...draft, unit_price_cop: Number(event.target.value) })} required />
            <Field label="Costo (COP)" type="number" min="0" value={draft.unit_cost_cop ?? ""} onChange={(event) => setDraft({ ...draft, unit_cost_cop: event.target.value === "" ? null : Number(event.target.value) })} />
            <Field label="Stock inicial" type="number" min="0" value={draft.stock_quantity} onChange={(event) => setDraft({ ...draft, stock_quantity: Number(event.target.value) })} required />
            <Field label="Alerta de stock bajo" type="number" min="0" value={draft.low_stock_threshold} onChange={(event) => setDraft({ ...draft, low_stock_threshold: Number(event.target.value) })} required />
            <div className="flex items-end"><Button type="submit" disabled={working}>{working ? "Guardando…" : "Crear prenda"}</Button></div>
          </form>
        </Panel>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-product-title">
          <form className="my-auto w-full max-w-2xl space-y-5 rounded-3xl bg-white p-6 shadow-2xl sm:p-8" onSubmit={saveProduct}>
            <div><h2 id="edit-product-title" className="text-xl font-bold">Editar {editing.sku}</h2><p className="mt-1 text-sm text-slate-500">La venta conserva su propia copia del precio y la variante.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SKU" value={editing.sku} onChange={(event) => setEditing({ ...editing, sku: event.target.value.toUpperCase() })} required />
              <Field label="Nombre" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required />
              <Field label="Categoría" value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })} required />
              <Field label="Talla" value={editing.size} onChange={(event) => setEditing({ ...editing, size: event.target.value })} required />
              <Field label="Color" value={editing.color} onChange={(event) => setEditing({ ...editing, color: event.target.value })} required />
              <Field label="Precio (COP)" type="number" min="1" value={editing.unit_price_cop} onChange={(event) => setEditing({ ...editing, unit_price_cop: Number(event.target.value) })} required />
              <Field label="Costo (COP)" type="number" min="0" value={editing.unit_cost_cop ?? ""} onChange={(event) => setEditing({ ...editing, unit_cost_cop: event.target.value === "" ? null : Number(event.target.value) })} />
              <Field label="Alerta stock bajo" type="number" min="0" value={editing.low_stock_threshold} onChange={(event) => setEditing({ ...editing, low_stock_threshold: Number(event.target.value) })} required />
            </div>
            <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={working}>Guardar</Button></div>
          </form>
        </div>
      )}

      {adjusting && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="adjust-title">
          <form className="w-full max-w-md space-y-5 rounded-3xl bg-white p-6 shadow-2xl" onSubmit={submitAdjustment}>
            <div><h2 id="adjust-title" className="text-xl font-bold">Ajustar existencias</h2><p className="mt-1 text-sm text-slate-500">{adjusting.name} · {adjusting.sku}</p></div>
            {error !== null && <ErrorNotice error={error} />}
            <Field label="Cambio de stock (usa negativo para retirar)" type="number" min="-1000000" max="1000000" value={delta} onChange={(event) => setDelta(Number(event.target.value))} required />
            <Field label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={240} required />
            <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setAdjusting(null)}>Cancelar</Button><Button type="submit" disabled={working || delta === 0 || reason.trim().length < 3}>Registrar ajuste</Button></div>
          </form>
        </div>
      )}
    </div>
  );
}
