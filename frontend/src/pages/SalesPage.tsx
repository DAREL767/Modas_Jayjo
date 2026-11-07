import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/endpoints";
import { ApiError } from "../api/client";
import type { CashSession, Product, Sale } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, ErrorNotice, Field, formatCop } from "../components/Panel";
import { Modal } from "../components/Modal";
import { saleAmounts, type CartItem } from "./sales/amounts";
import { CashPaymentStep } from "./sales/CashPaymentStep";
import { SaleCatalogStep } from "./sales/SaleCatalogStep";
import { SaleSuccessDialog } from "./sales/SaleSuccessDialog";
import { CashRegisterPage } from "./CashRegisterPage";
import "./sales/sales-flow.css";

type SaleStep = "catalog" | "payment";

export function SalesPage({ onReturnToDashboard = () => undefined }: { onReturnToDashboard?: () => void }) {
  const { accessToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [discountProduct, setDiscountProduct] = useState<Product | null>(null);
  const [discountDraft, setDiscountDraft] = useState(0);
  const [confirmGlobal, setConfirmGlobal] = useState(false);
  const [search, setSearch] = useState("");
  const [cashReceived, setCashReceived] = useState(0);
  const [sale, setSale] = useState<Sale | null>(null);
  const [step, setStep] = useState<SaleStep>("catalog");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const idempotencyKey = useRef<string | null>(null);
  const [needsOpening, setNeedsOpening] = useState(false);
  const resumeSale = useCallback((opened: CashSession) => {
    setCashSession(opened);
    setNeedsOpening(false);
    setStep("catalog");
    setError(null);
  }, []);

  const reloadProducts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [availableProducts, currentSession] = await Promise.all([
        api.inventory(accessToken),
        api.currentCashSession(accessToken),
      ]);
      setProducts(availableProducts);
      setCashSession(currentSession);
      setNeedsOpening(currentSession?.status !== "open");
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void reloadProducts(); }, [reloadProducts]);

  const returnToDashboard = useCallback(() => {
    setSale(null);
    setStep("catalog");
    setQuantities({});
    setDiscounts({}); setGlobalDiscount(0); setConfirmGlobal(false); setDiscountProduct(null);
    setCashReceived(0);
    setError(null);
    idempotencyKey.current = null;
    onReturnToDashboard();
  }, [onReturnToDashboard]);

  const cart: CartItem[] = products.flatMap((product) => {
    const quantity = quantities[product.id] ?? 0;
    return quantity > 0 ? [{ product, quantity, unitDiscountCop: discounts[product.id] ?? 0 }] : [];
  });
  const amounts = saleAmounts(cart, globalDiscount);
  const { subtotal, lineDiscount, discount, total } = amounts;

  const changeQuantity = (product: Product, next: number) => {
    setSale(null);
    setError(null);
    idempotencyKey.current = null;
    setGlobalDiscount(0);
    if (next <= 0) setDiscounts((current) => { const updated = { ...current }; delete updated[product.id]; return updated; });
    setQuantities((current) => {
      const quantity = Math.max(0, Math.min(product.stock_quantity, next));
      const updated = { ...current };
      if (quantity === 0) delete updated[product.id];
      else updated[product.id] = quantity;
      return updated;
    });
  };

  const startPayment = () => {
    if (!cashSession || cashSession.status !== "open") {
      setNeedsOpening(true);
      return;
    }
    setError(null);
    if (lineDiscount === 0) {
      setDiscountDraft(globalDiscount);
      setConfirmGlobal(true);
      return;
    }
    setCashReceived(0);
    setStep("payment");
  };

  const checkout = async () => {
    if (!accessToken || cart.length === 0 || cashReceived < total || !Number.isInteger(cashReceived) || cashReceived > 2_000_000_000) return;
    setWorking(true);
    setError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const completed = await api.createSale(
        accessToken,
        {
          items: cart.map(({ product, quantity, unitDiscountCop }) => ({ product_id: product.id, quantity, ...(unitDiscountCop > 0 ? { unit_discount_cop: unitDiscountCop } : {}) })),
          cash_received_cop: cashReceived,
          ...(globalDiscount > 0 ? { global_discount_cop: globalDiscount } : {}),
        },
        idempotencyKey.current,
      );
      setSale(completed);
      setQuantities({});
      setDiscounts({}); setGlobalDiscount(0);
      setCashReceived(0);
      idempotencyKey.current = null;
      await reloadProducts();
    } catch (caught) {
      setError(caught);
      if (caught instanceof ApiError && caught.status === 409 && caught.detail === "No hay una sesión de caja abierta") {
        setCashSession(null);
        setNeedsOpening(true);
        idempotencyKey.current = null;
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="sales-flow">
      <header className="sales-flow-header">
        {step === "payment" ? (
          <Button variant="secondary" onClick={() => { setError(null); setStep("catalog"); }}>Cancelar / Volver</Button>
        ) : (
          <Button variant="secondary" onClick={onReturnToDashboard}>Volver</Button>
        )}
        <h1>{step === "payment" ? "Procesar Pago" : "Nueva Venta"}</h1>
        <span className={`sales-cash-status ${cashSession?.status === "open" ? "is-open" : "is-closed"}`}>
          {cashSession?.status === "open" ? "● Activo" : "● Caja cerrada"}
        </span>
      </header>

      {loading ? (
        <section className="sale-card sales-loading">Cargando prendas y estado de caja…</section>
      ) : (
        <>
          {needsOpening ? <CashRegisterPage onOpened={resumeSale} /> : step === "catalog" ? (
            <>
              {error !== null && <div className="sales-flow-notice"><ErrorNotice error={error} /></div>}
              <SaleCatalogStep
                products={products}
                accessToken={accessToken}
                cart={cart}
                search={search}
                onSearchChange={setSearch}
                onAdd={(product) => changeQuantity(product, (quantities[product.id] ?? 0) + 1)}
                onRemove={(product) => changeQuantity(product, (quantities[product.id] ?? 0) - 1)}
                onContinue={startPayment}
                amounts={amounts}
                onDiscount={(product) => { setDiscountProduct(product); setDiscountDraft(discounts[product.id] ?? 0); }}
              />
            </>
          ) : (
            <CashPaymentStep
              total={total}
              subtotal={subtotal}
              discount={discount}
              cashReceived={cashReceived}
              error={error}
              working={working}
              onCashReceivedChange={(value) => { setCashReceived(value); idempotencyKey.current = null; }}
              onBack={() => { setError(null); setStep("catalog"); }}
              onConfirm={() => void checkout()}
            />
          )}
        </>
      )}
      {sale && <SaleSuccessDialog sale={sale} onReturn={returnToDashboard} />}
      {discountProduct && <Modal titleId="line-discount-title" onClose={() => setDiscountProduct(null)}>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (!Number.isInteger(discountDraft) || discountDraft < 0 || discountDraft > discountProduct.unit_price_cop) return;
          setDiscounts((current) => ({ ...current, [discountProduct.id]: discountDraft }));
          setGlobalDiscount(0); idempotencyKey.current = null; setDiscountProduct(null);
        }}>
          <h2 id="line-discount-title" className="text-xl font-bold">Descuento de {discountProduct.name}</h2>
          <p className="text-sm text-slate-600">Se aplica a cada unidad de esta variante. Precio por unidad: {formatCop(discountProduct.unit_price_cop)}.</p>
          <Field label="Descuento por unidad (COP)" type="number" inputMode="numeric" min={0} max={discountProduct.unit_price_cop} step={1} value={discountDraft} required onChange={(event) => setDiscountDraft(Number(event.target.value))} />
          <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setDiscountProduct(null)}>Cancelar</Button><Button type="submit">Aplicar descuento</Button></div>
        </form>
      </Modal>}
      {confirmGlobal && <Modal titleId="global-discount-title" onClose={() => setConfirmGlobal(false)}>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (!Number.isInteger(discountDraft) || discountDraft < 0 || discountDraft > subtotal) return;
          setGlobalDiscount(discountDraft); idempotencyKey.current = null;
          setCashReceived(0); setConfirmGlobal(false); setStep("payment");
        }}>
          <h2 id="global-discount-title" className="text-xl font-bold">Confirmar descuento de la venta</h2>
          <p className="text-sm text-slate-600">No hay descuentos por prenda. Aplica uno global o deja $0 para continuar sin descuento.</p>
          <Field label="Descuento global (COP)" type="number" inputMode="numeric" min={0} max={subtotal} step={1} value={discountDraft} required onChange={(event) => setDiscountDraft(Number(event.target.value))} />
          <p>Total a pagar: <strong>{formatCop(subtotal - discountDraft)}</strong></p>
          <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setConfirmGlobal(false)}>Volver al carrito</Button><Button type="submit">Confirmar y continuar</Button></div>
        </form>
      </Modal>}
    </div>
  );
}
