import { useRef, useState } from "react";
import type { Sale } from "../../api/types";
import { Modal } from "../../components/Modal";
import { Button, formatCop } from "../../components/Panel";

export function SaleSuccessDialog({ sale, onReturn }: { sale: Sale; onReturn: () => void }) {
  const receipt = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const date = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota",
  }).format(new Date(sale.created_at));

  const finish = async () => {
    if (closing) return;
    setClosing(true);
    const dialog = receipt.current?.closest("dialog");
    if (dialog?.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const animation = dialog.animate(
        [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(10px)" }],
        { duration: 170, easing: "ease-in", fill: "forwards" },
      );
      await animation.finished.catch(() => undefined);
    }
    onReturn();
  };

  return (
    <Modal titleId="sale-success-title" onClose={() => undefined}>
      <div ref={receipt} className="sale-receipt">
        <div className="sale-success-check" aria-hidden="true">✓</div>
        <h2 id="sale-success-title">¡Venta registrada!</h2>
        <p className="font-semibold">Comprobante de venta · Modas Jayjo</p>
        <p className="sale-receipt-meta">{date} · Venta {sale.sale_id}</p>
        <ul className="sale-receipt-items" aria-label="Prendas vendidas">
          {sale.items.map((item) => (
            <li key={item.product_id}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.sku} · {item.size} · {item.color}</p>
                <p>{item.quantity} × {formatCop(item.unit_price_cop)}</p>
                {!!item.unit_discount_cop && <p>Descuento por unidad {formatCop(item.unit_discount_cop)}</p>}
              </div>
              <strong>{formatCop(item.line_total_cop)}</strong>
            </li>
          ))}
        </ul>
        <dl>
          <div><dt>Subtotal</dt><dd>{formatCop(sale.subtotal_cop ?? sale.total_cop + (sale.discount_cop ?? 0))}</dd></div>
          <div><dt>Descuentos</dt><dd>{formatCop(sale.discount_cop ?? 0)}</dd></div>
          <div className="sale-receipt-total"><dt>Total pagado</dt><dd>{formatCop(sale.total_cop)}</dd></div>
          <div><dt>Efectivo recibido</dt><dd>{formatCop(sale.cash_received_cop)}</dd></div>
          <div><dt>Cambio</dt><dd>{formatCop(sale.change_cop)}</dd></div>
        </dl>
        <Button className="w-full" disabled={closing} onClick={() => void finish()}>Finalizar y volver al menú</Button>
      </div>
    </Modal>
  );
}
