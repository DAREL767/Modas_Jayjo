import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/endpoints";
import { ApiError } from "../api/client";
import type { CashSession, Product, Sale } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, ErrorNotice } from "../components/Panel";
import { CashPaymentStep } from "./sales/CashPaymentStep";
import { SaleCatalogStep } from "./sales/SaleCatalogStep";
import { SaleSuccessDialog } from "./sales/SaleSuccessDialog";
import { CashRegisterPage } from "./CashRegisterPage";
import "./sales/sales-flow.css";

type CartItem = { product: Product; quantity: number };
type SaleStep = "catalog" | "payment";

export function SalesPage({ onReturnToDashboard = () => undefined }: { onReturnToDashboard?: () => void }) {
  const { accessToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
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
    setCashReceived(0);
    setError(null);
    idempotencyKey.current = null;
    onReturnToDashboard();
  }, [onReturnToDashboard]);

  useEffect(() => {
    if (!sale) return;
    const timeout = window.setTimeout(returnToDashboard, 2200);
    return () => window.clearTimeout(timeout);
  }, [sale, returnToDashboard]);

  const cart: CartItem[] = products.flatMap((product) => {
    const quantity = quantities[product.id] ?? 0;
    return quantity > 0 ? [{ product, quantity }] : [];
  });
  const total = cart.reduce((sum, item) => sum + item.product.unit_price_cop * item.quantity, 0);

  const changeQuantity = (product: Product, next: number) => {
    setSale(null);
    setError(null);
    idempotencyKey.current = null;
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
    setCashReceived(total);
    setStep("payment");
  };

  const checkout = async () => {
    if (!accessToken || cart.length === 0 || cashReceived < total) return;
    setWorking(true);
    setError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const completed = await api.createSale(
        accessToken,
        {
          items: cart.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
          cash_received_cop: cashReceived,
        },
        idempotencyKey.current,
      );
      setSale(completed);
      setQuantities({});
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
                cart={cart}
                search={search}
                onSearchChange={setSearch}
                onAdd={(product) => changeQuantity(product, (quantities[product.id] ?? 0) + 1)}
                onRemove={(product) => changeQuantity(product, (quantities[product.id] ?? 0) - 1)}
                onContinue={startPayment}
              />
            </>
          ) : (
            <CashPaymentStep
              total={total}
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
    </div>
  );
}
