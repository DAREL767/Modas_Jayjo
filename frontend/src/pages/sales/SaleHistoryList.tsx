import { useEffect, useState } from "react";
import { api } from "../../api/endpoints";
import type { SaleHistoryEntry } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { Button, ErrorNotice, formatCop } from "../../components/Panel";

const PAGE_SIZE = 10;
const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota",
});

export function SaleHistoryList({ query, onSelect, disabled }: {
  query: string;
  onSelect?: (sale: SaleHistoryEntry) => void;
  disabled?: boolean;
}) {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<SaleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    const params = new URLSearchParams(query);
    params.set("skip", String(page * PAGE_SIZE));
    params.set("limit", String(PAGE_SIZE + 1));
    setLoading(true);
    setError(null);
    setRows([]);
    void api.saleHistory(accessToken, params, controller.signal)
      .then((sales) => { if (!controller.signal.aborted) setRows(sales); })
      .catch((caught) => { if (!controller.signal.aborted) setError(caught); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accessToken, query, page]);

  return <div className="space-y-3" aria-busy={loading}>
    {error !== null && <ErrorNotice error={error} />}
    {loading && <p role="status" className="text-sm">Consultando ventas…</p>}
    {!loading && error === null && rows.length === 0 && <p className="text-sm">No hay ventas que coincidan con la consulta.</p>}
    {rows.slice(0, PAGE_SIZE).map((sale) => <details key={sale.sale_id} className="rounded-xl border border-slate-200 p-3" open={onSelect ? true : undefined}>
      <summary className="cursor-pointer text-sm font-semibold">{dateFormat.format(new Date(sale.created_at))} · {formatCop(sale.total_cop)}</summary>
      <div className="mt-2 space-y-2">
        <p className="break-all text-xs text-slate-600">Venta {sale.sale_id}</p>
        <ul className="space-y-1 text-sm">
          {sale.items.map((item) => <li key={item.product_id}>
            {item.quantity} × {item.name} · {item.sku} · {item.size} / {item.color} · {formatCop(item.line_total_cop)}
          </li>)}
        </ul>
        {onSelect ? <Button type="button" variant="secondary" disabled={disabled} onClick={() => onSelect(sale)}>Elegir esta venta</Button> :
          <p className="text-sm text-slate-600">
            Descuentos {formatCop(sale.discount_cop ?? 0)} · Recibido {formatCop(sale.cash_received_cop)} · Cambio {formatCop(sale.change_cop)}
          </p>}
      </div>
    </details>)}
    {(page > 0 || rows.length > PAGE_SIZE) && <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" disabled={loading || disabled || page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
      <span className="text-sm">Página {page + 1}</span>
      <Button type="button" variant="secondary" disabled={loading || disabled || rows.length <= PAGE_SIZE} onClick={() => setPage(page + 1)}>Siguiente</Button>
    </div>}
  </div>;
}
