import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/endpoints";
import type { Product, Sale } from "../api/types";
import { SalesPage } from "./SalesPage";

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ accessToken: "test-token" }) }));

const product: Product = {
  id: "product-1", sku: "SKU-001", name: "Camisa azul", category: "Camisas",
  size: "M", color: "Azul", unit_price_cop: 85_000, stock_quantity: 4,
  low_stock_threshold: 1, is_active: true,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
const sale: Sale = {
  sale_id: "sale-1", status: "completed", items: [], total_cop: 85_000,
  cash_received_cop: 100_000, change_cop: 15_000, cashier_id: "user-1",
  cash_session_id: "cash-1", idempotency_key: "request-1", created_at: "2026-01-01T00:00:00Z",
};

describe("SalesPage sequential flow", () => {
  beforeEach(() => {
    vi.spyOn(api, "inventory").mockResolvedValue([product]);
    vi.spyOn(api, "currentCashSession").mockResolvedValue({
      id: "cash-1", status: "open", opening_cash_cop: 0, sales_cash_cop: 0,
      opened_by: "admin", opened_at: "2026-01-01T00:00:00Z",
    });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("moves from product selection to payment, confirms, then returns to the role dashboard", async () => {
    const onReturnToDashboard = vi.fn();
    vi.spyOn(api, "createSale").mockResolvedValue(sale);
    vi.stubGlobal("crypto", { randomUUID: () => "test-idempotency-key" });
    const successTimeout = vi.fn();
    const nativeSetTimeout = window.setTimeout.bind(window);
    vi.spyOn(window, "setTimeout").mockImplementation(((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 2200 && typeof handler === "function") successTimeout.mockImplementation(handler as () => void);
      return nativeSetTimeout(handler, delay, ...args);
    }) as typeof window.setTimeout);
    render(<SalesPage onReturnToDashboard={onReturnToDashboard} />);

    fireEvent.change(await screen.findByLabelText("Buscar por nombre o código"), { target: { value: "SKU-001" } });
    fireEvent.click(await screen.findByRole("button", { name: "Agregar" }));
    fireEvent.click(screen.getByRole("button", { name: "Proceder al cobro" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Procesar Pago" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Confirmar venta/ }));
    expect(await screen.findByRole("dialog", { name: "¡Venta registrada!" })).toBeInTheDocument();
    expect(api.createSale).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Finalizar y volver al menú" }));
    expect(onReturnToDashboard).toHaveBeenCalledOnce();
  });

  it("shows a clear message and stays in the catalog when the cash register is closed", async () => {
    vi.spyOn(api, "currentCashSession").mockResolvedValue(null);
    render(<SalesPage onReturnToDashboard={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText("Buscar por nombre o código"), { target: { value: "SKU-001" } });
    fireEvent.click(await screen.findByRole("button", { name: "Agregar" }));
    fireEvent.click(screen.getByRole("button", { name: "Proceder al cobro" }));

    expect(await screen.findByText(/No hay una caja abierta/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nueva Venta" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Procesar Pago" })).not.toBeInTheDocument();
  });
});
