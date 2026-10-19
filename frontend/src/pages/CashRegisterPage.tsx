import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/endpoints";
import type { CashSession } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, ErrorNotice, Field, formatCop, Notice, Panel } from "../components/Panel";

const todayInBogota = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export function CashRegisterPage() {
  const { accessToken, user } = useAuth();
  const [session, setSession] = useState<CashSession | null>(null);
  const [openingCash, setOpeningCash] = useState(0);
  const [countedCash, setCountedCash] = useState(0);
  const [startDate, setStartDate] = useState(todayInBogota);
  const [endDate, setEndDate] = useState(todayInBogota);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const isAdmin = user?.role === "admin";

  const reload = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try { setSession(await api.currentCashSession(accessToken)); }
    catch (caught) { setError(caught); }
    finally { setLoading(false); }
  }, [accessToken]);
  useEffect(() => { void reload(); }, [reload]);

  const openSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !isAdmin) return;
    setWorking(true); setError(null); setNotice("");
    try {
      setSession(await api.openCashSession(accessToken, openingCash, note.trim() || undefined));
      setCountedCash(0); setNote(""); setNotice("La caja quedó abierta.");
    } catch (caught) { setError(caught); }
    finally { setWorking(false); }
  };

  const closeSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !isAdmin || !session) return;
    setWorking(true); setError(null); setNotice("");
    try {
      setSession(await api.closeCashSession(accessToken, countedCash, note.trim() || undefined));
      setNote(""); setNotice("El conteo y el cierre de caja quedaron registrados.");
    } catch (caught) { setError(caught); }
    finally { setWorking(false); }
  };

  const loadHistory = async () => {
    if (!accessToken || !isAdmin) return;
    setWorking(true); setError(null);
    try { setHistory(await api.cashHistory(accessToken, startDate, endDate)); }
    catch (caught) { setError(caught); }
    finally { setWorking(false); }
  };

  return <div className="space-y-6"><Panel title="Cierre de caja diario" description="Consulta el estado y, como administrador, registra el arqueo y el cierre.">
    <div className="space-y-5">
      {error !== null && <ErrorNotice error={error} />}{notice && <Notice tone="success">{notice}</Notice>}
      {loading ? <p className="py-8 text-center text-sm text-slate-500">Consultando caja…</p> : !session ? <>
        <Notice tone="info">No hay una caja abierta actualmente.</Notice>
        {isAdmin && <form className="grid gap-4 sm:grid-cols-2" onSubmit={openSession}>
          <Field label="Base inicial en efectivo (COP)" type="number" min="0" step="1" value={openingCash} onChange={(event) => setOpeningCash(Number(event.target.value))} required />
          <Field label="Nota de apertura (opcional)" value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} />
          <div className="sm:col-span-2"><Button type="submit" disabled={working}>{working ? "Abriendo…" : "Abrir caja"}</Button></div>
        </form>}
      </> : <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Ventas en efectivo</p><p className="mt-1 text-lg font-bold text-slate-900">{formatCop(session.sales_cash_cop)}</p></div>
          {session.expected_cash_cop != null && <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Efectivo esperado</p><p className="mt-1 text-lg font-bold text-slate-900">{formatCop(session.expected_cash_cop)}</p></div>}
          {session.difference_cash_cop != null && <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Diferencia</p><p className="mt-1 text-lg font-bold text-slate-900">{formatCop(session.difference_cash_cop)}</p></div>}
        </div>
        <dl className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Estado</dt><dd className="mt-1 font-semibold text-emerald-700">{session.status === "open" ? "Abierta" : "Cerrada"}</dd></div>
          <div><dt className="text-slate-500">Base inicial</dt><dd className="mt-1 font-semibold">{formatCop(session.opening_cash_cop)}</dd></div>
          <div><dt className="text-slate-500">Apertura</dt><dd className="mt-1">{new Date(session.opened_at).toLocaleString("es-CO")}</dd></div>
          {session.closed_at && <div><dt className="text-slate-500">Cierre</dt><dd className="mt-1">{new Date(session.closed_at).toLocaleString("es-CO")}</dd></div>}
        </dl>
        {session.status === "open" && isAdmin && <form className="space-y-4 border-t border-slate-200 pt-5" onSubmit={closeSession}>
          <div><h3 className="font-semibold text-slate-900">Arqueo de efectivo</h3><p className="mt-1 text-sm text-slate-500">Compara el efectivo contado con la base inicial y las ventas.</p></div>
          <Field label="Efectivo contado físicamente (COP)" type="number" min="0" step="1" value={countedCash} onChange={(event) => setCountedCash(Number(event.target.value))} required />
          <Field label="Notas / gastos del día (opcional)" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
          <p className="text-xs text-slate-500">Registra aquí gastos y pagos electrónicos para que queden asociados al cierre.</p>
          <Button type="submit" variant="danger" disabled={working}>{working ? "Cerrando…" : "Confirmar y cerrar caja"}</Button>
        </form>}
      </>}
      {!isAdmin && <p className="text-xs text-slate-500">La apertura y el cierre están disponibles solo para administración.</p>}
      {!loading && <Button variant="secondary" onClick={() => void reload()}>Actualizar estado</Button>}
    </div>
  </Panel>{isAdmin && <Panel title="Historial de cierres" description="Consulta los arqueos registrados por fecha.">
    <div className="flex flex-wrap items-end gap-3"><Field label="Desde" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /><Field label="Hasta" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /><Button disabled={working || endDate < startDate} onClick={() => void loadHistory()}>Buscar cierres</Button></div>
    {history.length === 0 ? <p className="mt-5 text-sm text-slate-500">No hay cierres para mostrar en el rango seleccionado.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Fecha</th><th className="py-2">Ventas efectivo</th><th className="py-2">Contado</th><th className="py-2">Diferencia</th><th className="py-2">Notas</th></tr></thead><tbody className="divide-y divide-slate-100">{history.map((closed) => <tr key={closed.id}><td className="py-3">{closed.closed_at ? new Date(closed.closed_at).toLocaleString("es-CO") : "—"}</td><td>{formatCop(closed.sales_cash_cop)}</td><td>{closed.counted_cash_cop == null ? "—" : formatCop(closed.counted_cash_cop)}</td><td>{closed.difference_cash_cop == null ? "—" : formatCop(closed.difference_cash_cop)}</td><td className="max-w-64 truncate">{closed.closing_note || "—"}</td></tr>)}</tbody></table></div>}
  </Panel>}</div>;
}
