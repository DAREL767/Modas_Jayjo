import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/endpoints";
import type { CashSession, PaymentMethod } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, ErrorNotice, Field, formatCop, Notice, Panel } from "../components/Panel";

const methods: PaymentMethod[] = ["cash", "card", "transfer"];
const labels: Record<PaymentMethod, string> = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };
const zeroCount = (): Record<PaymentMethod, number> => ({ cash: 0, card: 0, transfer: 0 });

export function CashRegisterPage() {
  const { accessToken, user } = useAuth();
  const [session, setSession] = useState<CashSession | null>(null);
  const [openingCash, setOpeningCash] = useState(0);
  const [counts, setCounts] = useState(zeroCount);
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
      setCounts(zeroCount()); setNote(""); setNotice("La caja quedó abierta.");
    } catch (caught) { setError(caught); }
    finally { setWorking(false); }
  };

  const closeSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !isAdmin || !session) return;
    setWorking(true); setError(null); setNotice("");
    try {
      setSession(await api.closeCashSession(accessToken, counts, note.trim() || undefined));
      setNote(""); setNotice("El conteo y el cierre de caja quedaron registrados.");
    } catch (caught) { setError(caught); }
    finally { setWorking(false); }
  };

  return <Panel title="Caja del turno" description="Consulta el estado y, como administrador, registra la apertura o el cierre.">
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
          {methods.map((method) => <div key={method} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Ventas · {labels[method]}</p><p className="mt-1 text-lg font-bold text-slate-900">{formatCop(session.sales_by_payment_cop[method])}</p></div>)}
        </div>
        <dl className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Estado</dt><dd className="mt-1 font-semibold text-emerald-700">{session.status === "open" ? "Abierta" : "Cerrada"}</dd></div>
          <div><dt className="text-slate-500">Base inicial</dt><dd className="mt-1 font-semibold">{formatCop(session.opening_cash_cop)}</dd></div>
          <div><dt className="text-slate-500">Apertura</dt><dd className="mt-1">{new Date(session.opened_at).toLocaleString("es-CO")}</dd></div>
          {session.closed_at && <div><dt className="text-slate-500">Cierre</dt><dd className="mt-1">{new Date(session.closed_at).toLocaleString("es-CO")}</dd></div>}
        </dl>
        {session.status === "open" && isAdmin && <form className="space-y-4 border-t border-slate-200 pt-5" onSubmit={closeSession}>
          <div><h3 className="font-semibold text-slate-900">Conteo físico</h3><p className="mt-1 text-sm text-slate-500">Registra lo contado por método de pago. El backend calcula diferencias.</p></div>
          <div className="grid gap-4 sm:grid-cols-3">{methods.map((method) => <Field key={method} label={`${labels[method]} (COP)`} type="number" min="0" step="1" value={counts[method]} onChange={(event) => setCounts((current) => ({ ...current, [method]: Number(event.target.value) }))} required />)}</div>
          <Field label="Nota de cierre (opcional)" value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} />
          <Button type="submit" variant="danger" disabled={working}>{working ? "Cerrando…" : "Registrar cierre"}</Button>
        </form>}
        {session.status === "closed" && session.difference_by_payment_cop && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-900">Diferencias del conteo</h3><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">{methods.map((method) => <p key={method}>{labels[method]}: <strong>{formatCop(session.difference_by_payment_cop![method])}</strong></p>)}</div></div>}
      </>}
      {!isAdmin && <p className="text-xs text-slate-500">La apertura y el cierre están disponibles solo para administración.</p>}
      {!loading && <Button variant="secondary" onClick={() => void reload()}>Actualizar estado</Button>}
    </div>
  </Panel>;
}
