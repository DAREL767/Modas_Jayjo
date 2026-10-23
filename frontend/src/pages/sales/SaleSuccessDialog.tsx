import type { Sale } from "../../api/types";
import { Button, formatCop } from "../../components/Panel";

export function SaleSuccessDialog({ sale, onReturn }: { sale: Sale; onReturn: () => void }) {
  return (
    <div className="sale-success-backdrop">
      <section className="sale-success-dialog" role="dialog" aria-modal="true" aria-labelledby="sale-success-title">
        <div className="sale-success-check" aria-hidden="true">✓</div>
        <h2 id="sale-success-title">¡Venta registrada!</h2>
        <p>Detalles de la venta</p>
        <dl>
          <div><dt>Total</dt><dd>{formatCop(sale.total_cop)}</dd></div>
          <div><dt>Recibido</dt><dd>{formatCop(sale.cash_received_cop)}</dd></div>
          <div><dt>Devuelta</dt><dd>{formatCop(sale.change_cop)}</dd></div>
        </dl>
        <Button onClick={onReturn}>Finalizar y volver al menú</Button>
        <span className="sale-success-caption">Volverás al menú principal en un momento.</span>
      </section>
    </div>
  );
}
