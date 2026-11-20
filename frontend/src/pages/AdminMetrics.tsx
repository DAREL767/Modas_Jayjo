import { useCallback, useEffect, useState } from "react";
import { api } from "../api/endpoints";
import type { DashboardMetrics } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { ErrorNotice, formatCop } from "../components/Panel";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

export function AdminMetrics({ onSales, onStock }: { onSales: () => void; onStock: () => void }) {
  const { accessToken } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const refresh = useCallback(async (signal: AbortSignal) => {
    if (!accessToken) return;
    const data = await api.dashboardMetrics(accessToken, signal);
    if (!signal.aborted) {
      setMetrics(data);
      setError(null);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    setLoading(true);
    void refresh(controller.signal)
      .catch((caught) => { if (!controller.signal.aborted) setError(caught); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accessToken, refresh]);
  const refreshError = useAutoRefresh(refresh, !!accessToken && !loading);

  return <section className="dashboard-metrics" aria-labelledby="metrics-title" aria-busy={loading}>
    <div className="dashboard-section-heading">
      <h2 id="metrics-title">Métricas del día{metrics ? ` · ${metrics.date.split("-").reverse().join("/")}` : ""}</h2>
      <span className="dashboard-coming-soon">Actualización cada 10 s</span>
    </div>
    {(error ?? refreshError) != null && <div className="mb-3"><ErrorNotice error={error ?? refreshError} /></div>}
    <dl className="dashboard-metric-grid">
      <div><dt>Ventas totales</dt><dd>
        <button type="button" onClick={onSales} aria-label="Ver caja y ventas del día" className="rounded-lg underline decoration-slate-300 underline-offset-4">
          {metrics ? formatCop(metrics.sales_total_cop) : "—"}
        </button>
        <span>Después de descuentos</span>
      </dd></div>
      <div><dt>Prendas vendidas</dt><dd>
        <button type="button" onClick={onSales} aria-label="Ver detalle de prendas vendidas" className="rounded-lg underline decoration-slate-300 underline-offset-4">
          {metrics ? metrics.units_sold.toLocaleString("es-CO") : "—"}
        </button>
        <span>Unidades en ventas del día</span>
      </dd></div>
      <div><dt>Alertas de stock</dt><dd>
        <button type="button" onClick={onStock} aria-label="Ver prendas con stock bajo" className="rounded-lg underline decoration-slate-300 underline-offset-4">
          {metrics ? metrics.low_stock_count.toLocaleString("es-CO") : "—"}
        </button>
        <span>Variantes en umbral o agotadas</span>
      </dd></div>
    </dl>
  </section>;
}
