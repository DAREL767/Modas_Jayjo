import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api } from "../api/endpoints";
import type { ChangeRequest, ChangeStatus, Product, ProductChange, ReturnLine } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, ErrorNotice, Field, formatCop, Notice, Panel } from "../components/Panel";

const selectClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2";
const labelClass = "grid gap-1.5 text-sm font-medium text-slate-700";
const statusNames: Record<ChangeStatus, string> = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" };
const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota",
});

function differenceLabel(amount: number) {
  if (amount > 0) return `Cobrar al cliente ${formatCop(amount)}`;
  if (amount < 0) return `Devolver al cliente ${formatCop(-amount)}`;
  return "Sin diferencia de efectivo";
}

function ProductPicker({ label, products, selected, onSelect, disabled }: {
  label: string;
  products: Product[];
  selected: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const selectId = useId();
  const terms = search.trim().toLocaleLowerCase("es-CO").split(/\s+/);
  const matches = products.filter((item) => {
    const description = `${item.sku} ${item.name} ${item.size} ${item.color}`.toLocaleLowerCase("es-CO");
    return item.id === selected || terms.every((term) => description.includes(term));
  });
  return <div className="space-y-2">
    <Field label={`Buscar ${label.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, SKU, talla o color" disabled={disabled} />
    <div className={labelClass}>
      <label htmlFor={selectId}>{label}</label>
      <select id={selectId} className={selectClass} value={selected} onChange={(event) => onSelect(event.target.value)} required disabled={disabled}>
        <option value="">Selecciona una variante</option>
        {matches.map((item) => <option key={item.id} value={item.id}>
          {item.name} · {item.sku} · {item.size} / {item.color} · {item.stock_quantity} disponibles · {formatCop(item.unit_price_cop)}
        </option>)}
      </select>
    </div>
  </div>;
}

export function ChangesPage() {
  const { accessToken } = useAuth();
  const [kind, setKind] = useState<ChangeRequest["kind"]>("defect");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [replacementId, setReplacementId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [lines, setLines] = useState<ReturnLine[] | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [submitted, setSubmitted] = useState<ProductChange | null>(null);
  const lastAttempt = useRef<{ id: string; payload: string } | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void api.inventory(accessToken).then((items) => {
      if (active) setProducts(items.filter((item) => item.is_active && item.stock_quantity > 0));
    }).catch((caught) => { if (active) setError(caught); });
    return () => { active = false; };
  }, [accessToken]);

  const selectedLine = lines?.find((line) => line.product_id === productId);
  const replacement = products.find((item) => item.id === replacementId);
  const lookup = async () => {
    if (!accessToken || busy || !saleId.trim()) return;
    setBusy(true);
    setError(null);
    setLines(null);
    setProductId("");
    setReplacementId("");
    try {
      setLines(await api.returnLines(accessToken, saleId.trim()));
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || busy || !productId || reason.trim().length < 3) return;
    if (kind === "exchange" && (!selectedLine || !replacement)) return;
    setBusy(true);
    setError(null);
    setSubmitted(null);
    try {
      const body: ChangeRequest = { kind, product_id: productId, reason: reason.trim() };
      if (kind === "exchange") {
        body.sale_id = saleId.trim();
        body.replacement_id = replacementId;
      }
      const payload = JSON.stringify(body);
      if (lastAttempt.current?.payload !== payload) lastAttempt.current = { id: crypto.randomUUID(), payload };
      setSubmitted(await api.createChange(accessToken, body, lastAttempt.current.id));
      lastAttempt.current = null;
      setProductId("");
      setReplacementId("");
      setSaleId("");
      setLines(null);
      setReason("");
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return <Panel title="Solicitar cambio o retiro" description="Describe lo ocurrido. Administración revisará la solicitud antes de aplicar movimientos.">
    {error !== null && <ErrorNotice error={error} />}
    {submitted && <Notice tone="success">
      Solicitud enviada a Reportes. Referencia <span className="break-all">{submitted.id}</span>.
      {submitted.kind === "exchange" && <p>{differenceLabel(submitted.difference_cop)} al aprobar.</p>}
    </Notice>}
    <form onSubmit={submit} className="mt-4 max-w-2xl space-y-5">
      <label className={labelClass}>Tipo de novedad
        <select className={selectClass} value={kind} disabled={busy} onChange={(event) => {
          setKind(event.target.value as ChangeRequest["kind"]);
          setProductId(""); setReplacementId(""); setLines(null); setSubmitted(null); setError(null); setReason("");
        }}>
          <option value="defect">Prenda dañada en inventario</option>
          <option value="exchange">Cambio solicitado por el cliente</option>
        </select>
      </label>
      {kind === "defect" ? <ProductPicker key="defect" label="Prenda dañada" products={products} selected={productId} onSelect={setProductId} disabled={busy} /> : <>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label="Número de la venta original" value={saleId} maxLength={40} disabled={busy} onChange={(event) => {
              setSaleId(event.target.value); setLines(null); setProductId(""); setReplacementId("");
            }} />
          </div>
          <Button type="button" variant="secondary" disabled={busy || !saleId.trim()} onClick={() => void lookup()}>Buscar venta</Button>
        </div>
        {lines?.length === 0 && <Notice tone="info">Esta venta ya no tiene unidades disponibles para cambio.</Notice>}
        {!!lines?.length && <label className={labelClass}>Prenda que devuelve el cliente
          <select className={selectClass} required value={productId} disabled={busy} onChange={(event) => {
            setProductId(event.target.value); setReplacementId("");
          }}>
            <option value="">Selecciona una prenda de la venta</option>
            {lines.map((line) => <option key={line.product_id} value={line.product_id}>
              {line.name} · {line.sku} · {line.size} / {line.color} · {formatCop(line.credit_cop)} pagados por esta unidad
            </option>)}
          </select>
        </label>}
        {selectedLine && <ProductPicker key={productId} label="Prenda que se entrega" products={products.filter((item) => item.id !== productId)}
          selected={replacementId} onSelect={setReplacementId} disabled={busy} />}
        {selectedLine && replacement && <Notice tone="info">
          Crédito de la venta original {formatCop(selectedLine.credit_cop)}. Precio de la prenda elegida {formatCop(replacement.unit_price_cop)}.
          {" "}{differenceLabel(replacement.unit_price_cop - selectedLine.credit_cop)}.
        </Notice>}
      </>}
      <label className={labelClass}>{kind === "defect" ? "Descripción del daño" : "Motivo del cambio"}
        <textarea className={selectClass} required minLength={3} maxLength={500} rows={3} disabled={busy} value={reason}
          placeholder={kind === "defect" ? "Ej. Costura lateral abierta" : "Ej. Cambiar de talla M a L o de azul a negro"}
          onChange={(event) => setReason(event.target.value)} />
      </label>
      <Button type="submit" disabled={busy || !productId || reason.trim().length < 3 || (kind === "exchange" && !replacement)}>
        {busy ? "Procesando…" : "Enviar solicitud"}
      </Button>
    </form>
  </Panel>;
}

const PAGE_SIZE = 20;

export function ChangeReportsPage() {
  const { accessToken } = useAuth();
  const [state, setState] = useState<ChangeStatus | "">("pending");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ProductChange[]>([]);
  const [filters, setFilters] = useState("state=pending");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (query: string, nextPage: number) => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams(query);
      params.set("skip", String(nextPage * PAGE_SIZE));
      params.set("limit", String(PAGE_SIZE + 1));
      setRows(await api.changes(accessToken, params));
      setFilters(query);
      setPage(nextPage);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }, [accessToken]);

  useEffect(() => { void load("state=pending", 0); }, [load]);

  const searchReports = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    const query = new URLSearchParams();
    if (state) query.set("state", state);
    if (start && end) {
      query.set("start_date", start);
      query.set("end_date", end);
    }
    if (search.trim()) query.set("search", search.trim());
    void load(query.toString(), 0);
  };

  const resolve = async (row: ProductChange, decision: "approve" | "reject") => {
    if (!accessToken || busy) return;
    const prompt = decision === "reject" ? "¿Rechazar esta solicitud?" : row.kind === "defect"
      ? "¿Aprobar el retiro de una unidad dañada?"
      : `¿Aprobar el cambio? ${differenceLabel(row.difference_cop)}.`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const result = await api.resolveChange(accessToken, row.id, decision);
      setRows((current) => current.map((item) => item.id === result.id ? result : item));
      setNotice(decision === "approve" ? "Solicitud aprobada. Movimientos registrados." : "Solicitud rechazada.");
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return <Panel title="Reportes de cambios y defectos" description="Revisa solicitudes pendientes y busca por fecha de solicitud, prenda, SKU o número de venta.">
    <form onSubmit={searchReports} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className={labelClass}>Estado
        <select className={selectClass} value={state} onChange={(event) => setState(event.target.value as ChangeStatus | "")}>
          <option value="">Todos</option>
          {Object.entries(statusNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <Field label="Desde" type="date" value={start} required={!!end} onChange={(event) => setStart(event.target.value)} />
      <Field label="Hasta" type="date" value={end} required={!!start} min={start} onChange={(event) => setEnd(event.target.value)} />
      <Field label="Buscar en reportes" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} />
      <Button type="submit" disabled={busy}>Buscar solicitudes</Button>
    </form>
    <div className="mt-5 space-y-4" aria-busy={busy}>
      {error !== null && <ErrorNotice error={error} />}
      {notice && <Notice tone="success">{notice}</Notice>}
      {!busy && rows.length === 0 && <p className="text-sm text-slate-600">No hay solicitudes con esos filtros.</p>}
      {rows.slice(0, PAGE_SIZE).map((row) => <article key={row.id} className="space-y-2 rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{row.kind === "defect" ? "Retiro por defecto" : "Cambio de cliente"}</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{statusNames[row.status]}</span>
        </div>
        <p className="text-sm text-slate-600">Solicitada {dateFormat.format(new Date(row.created_at))}</p>
        <p>{row.product.name} · {row.product.sku} · {row.product.size} / {row.product.color}</p>
        {row.replacement && <>
          <p>Entrega {row.replacement.name} · {row.replacement.sku} · {row.replacement.size} / {row.replacement.color}</p>
          <p className="text-sm text-slate-600">Crédito {formatCop(row.credit_cop)} · Precio de entrega {formatCop(row.replacement_price_cop)}</p>
          <p className="font-semibold">{differenceLabel(row.difference_cop)}</p>
          <p className="break-all text-sm text-slate-600">Venta original {row.sale_id}</p>
        </>}
        <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{row.reason}</p>
        {row.resolved_at && <p className="text-sm text-slate-600">Resuelta {dateFormat.format(new Date(row.resolved_at))}</p>}
        {row.status === "pending" && <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void resolve(row, "approve")}>Aprobar</Button>
          <Button variant="secondary" disabled={busy} onClick={() => void resolve(row, "reject")}>Rechazar</Button>
        </div>}
      </article>)}
      {(page > 0 || rows.length > PAGE_SIZE) && <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={busy || page === 0} onClick={() => void load(filters, page - 1)}>Anterior</Button>
        <span className="text-sm">Página {page + 1}</span>
        <Button variant="secondary" disabled={busy || rows.length <= PAGE_SIZE} onClick={() => void load(filters, page + 1)}>Siguiente</Button>
      </div>}
    </div>
  </Panel>;
}
