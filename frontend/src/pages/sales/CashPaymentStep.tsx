import { Button, Field, formatCop } from "../../components/Panel";

const QUICK_CASH_AMOUNTS = [20_000, 50_000, 100_000];

export function CashPaymentStep({
  total, cashReceived, error, working, onCashReceivedChange, onBack, onConfirm,
}: {
  total: number;
  cashReceived: number;
  error: unknown;
  working: boolean;
  onCashReceivedChange: (value: number) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const change = Math.max(cashReceived - total, 0);
  const errorMessage = error instanceof Error ? error.message : null;

  return (
    <section className="sale-card sale-payment-card">
      <div className="sale-payment-total"><span>Total a pagar</span><strong>{formatCop(total)}</strong></div>
      {errorMessage && <div className="sale-inline-error" role="alert">{errorMessage}</div>}
      <div className="sale-payment-content">
        <Field label="Efectivo recibido" type="number" inputMode="numeric" min={total} max={2_000_000_000} step="1" value={cashReceived || ""} onChange={(event) => onCashReceivedChange(Number(event.target.value))} placeholder="Ingresa el valor recibido" required />
        <div className="sale-quick-cash">
          <p>Billetes rápidos</p>
          <div>{QUICK_CASH_AMOUNTS.map((amount) => <button type="button" key={amount} onClick={() => onCashReceivedChange(amount)}>{formatCop(amount)}</button>)}</div>
        </div>
        <button type="button" className="sale-exact-cash" onClick={() => onCashReceivedChange(total)}>Pago exacto <strong>{formatCop(total)}</strong></button>
        <div className="sale-change-row"><span>Cambio a entregar</span><strong>{formatCop(change)}</strong></div>
      </div>
      <div className="sale-card-footer sale-payment-actions">
        <Button variant="secondary" onClick={onBack}>Volver al carrito</Button>
        <Button className="sale-confirm-button" disabled={working || cashReceived < total} onClick={onConfirm}>{working ? "Procesando venta…" : "✓ Confirmar venta"}</Button>
      </div>
    </section>
  );
}
