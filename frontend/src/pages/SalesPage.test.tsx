import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/endpoints";
import { ApiError } from "../api/client";
import type { Product, Sale } from "../api/types";
import { SalesPage } from "./SalesPage";

const auth = vi.hoisted(() => ({ role: "admin" }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ accessToken: "test-token", user: { role: auth.role } }) }));

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
    auth.role = "admin";
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

  it("opens the register then returns automatically to the sale", async () => {
    vi.spyOn(api, "currentCashSession").mockResolvedValue(null);
    vi.spyOn(api, "openCashSession").mockResolvedValue({
      id: "cash-1", status: "open", opening_cash_cop: 50000, sales_cash_cop: 0,
      opened_by: "admin", opened_at: "2026-01-01T00:00:00Z",
    });
    render(<SalesPage onReturnToDashboard={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Abrir caja para vender" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Buscar por nombre o código")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Base inicial en efectivo (COP)"), { target: { value: "50000" } });
    fireEvent.click(screen.getByRole("button", { name: "Abrir caja" }));
    expect(await screen.findByLabelText("Buscar por nombre o código")).toBeInTheDocument();
    expect(api.openCashSession).toHaveBeenCalledWith("test-token", 50000, undefined);
  });

  it("allows vendors to resume after administration opens, without granting opening permission", async () => {
    auth.role = "vendor";
    const current = vi.spyOn(api, "currentCashSession").mockResolvedValue(null);
    const open = vi.spyOn(api, "openCashSession");
    render(<SalesPage />);
    await screen.findByText("No hay una caja abierta actualmente.");
    expect(screen.queryByRole("button", { name: "Abrir caja" })).not.toBeInTheDocument();
    current.mockResolvedValue({ id: "cash-1", status: "open", opening_cash_cop: 0, sales_cash_cop: 0, opened_by: "admin", opened_at: "2026-01-01T00:00:00Z" });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
    expect(await screen.findByLabelText("Buscar por nombre o código")).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it("keeps opening visible if the server rejects the opening", async () => {
    vi.spyOn(api, "currentCashSession").mockResolvedValue(null);
    vi.spyOn(api, "openCashSession").mockRejectedValue(new Error("No se pudo abrir"));
    render(<SalesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir caja" }));
    expect(await screen.findByText("No se pudo abrir")).toBeInTheDocument();
    expect(screen.queryByLabelText("Buscar por nombre o código")).not.toBeInTheDocument();
  });

  it("preserves the cart when the register closes during payment and resumes after reopening", async () => {
    vi.spyOn(api, "createSale").mockRejectedValue(new ApiError(409, "No hay una sesión de caja abierta"));
    vi.spyOn(api, "currentCashSession").mockResolvedValueOnce({ id: "cash-1", status: "open", opening_cash_cop: 0, sales_cash_cop: 0, opened_by: "admin", opened_at: "2026-01-01T00:00:00Z" }).mockResolvedValue(null);
    vi.spyOn(api, "openCashSession").mockResolvedValue({ id: "cash-2", status: "open", opening_cash_cop: 0, sales_cash_cop: 0, opened_by: "admin", opened_at: "2026-01-01T00:00:00Z" });
    render(<SalesPage />);
    const input = await screen.findByLabelText("Buscar por nombre o código");
    fireEvent.change(input, { target: { value: "SKU-001" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Proceder al cobro" }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar venta/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Abrir caja" }));
    await screen.findByLabelText("Buscar por nombre o código");
    expect(screen.getByText("Camisa azul")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proceder al cobro" })).toBeEnabled();
  });

  it("adds exact scanner codes with Enter repeatedly and respects available stock", async () => {
    render(<SalesPage />);
    const input = await screen.findByLabelText("Buscar por nombre o código");
    for (let index = 0; index < 5; index++) {
      fireEvent.change(input, { target: { value: "sku-001" } });
      fireEvent.keyDown(input, { key: "Enter" });
    }
    expect(screen.getByRole("button", { name: "Agregar una unidad de Camisa azul" })).toBeDisabled();
    expect(screen.getByText("Disponibles: 0")).toBeInTheDocument();
  });

  it("narrows suggestions by name and variant terms in any order without accents", async () => {
    vi.spyOn(api, "inventory").mockResolvedValue([
      { ...product, name: "Jean niño", category: "Jeans", color: "Azul" },
      { ...product, id: "product-2", sku: "SKU-002", name: "Jean dama", category: "Jeans", color: "Negro" },
    ]);
    render(<SalesPage />);
    const input = await screen.findByLabelText("Buscar por nombre o código");
    fireEvent.change(input, { target: { value: "jean" } });
    expect(screen.getAllByRole("button", { name: "Agregar" })).toHaveLength(2);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Agrega prendas para iniciar la venta.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "azul nino jean" } });
    expect(screen.getAllByRole("button", { name: "Agregar" })).toHaveLength(1);
    expect(screen.getByText("Jean niño")).toBeInTheDocument();
    expect(screen.queryByText("Jean dama")).not.toBeInTheDocument();
  });
});
