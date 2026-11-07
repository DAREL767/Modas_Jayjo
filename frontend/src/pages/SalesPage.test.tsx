import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/endpoints";
import { ApiError } from "../api/client";
import type { Product, Sale } from "../api/types";
import { SalesPage } from "./SalesPage";

const auth = vi.hoisted(() => ({ role: "admin" }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ accessToken: "test-token", user: { role: auth.role } }) }));
vi.mock("../components/CameraScanner", () => ({ CameraScanButton: ({ onDetected }: { onDetected: (code: string) => void }) => <button type="button" onClick={() => onDetected("SKU-001")}>Escanear código</button> }));

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
    const timeout = vi.spyOn(window, "setTimeout");
    render(<SalesPage onReturnToDashboard={onReturnToDashboard} />);

    fireEvent.change(await screen.findByLabelText("Buscar por nombre o código"), { target: { value: "SKU-001" } });
    fireEvent.click(await screen.findByRole("button", { name: "Agregar" }));
    fireEvent.click(screen.getByRole("button", { name: "Proceder al cobro" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y continuar" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Procesar Pago" })).toBeInTheDocument());

    for (const amount of ["2.000", "5.000", "10.000"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp("^\\+.*" + amount.replace(".", "\\.") + "$") }));
    }
    expect(screen.getByLabelText("Efectivo recibido")).toHaveValue(17000);
    fireEvent.click(screen.getByRole("button", { name: /Pago exacto/ }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar venta/ }));
    expect(await screen.findByRole("dialog", { name: "¡Venta registrada!" })).toBeInTheDocument();
    expect(api.createSale).toHaveBeenCalledOnce();
    expect(screen.getByText("Comprobante de venta · Modas Jayjo")).toBeInTheDocument();
    expect(timeout).not.toHaveBeenCalledWith(expect.any(Function), 2200);
    expect(onReturnToDashboard).not.toHaveBeenCalled();

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
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y continuar" }));
    fireEvent.click(screen.getByRole("button", { name: /Pago exacto/ }));
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

  it("uses a camera reading to find the variant before confirming the cart addition", async () => {
    render(<SalesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Escanear código" }));
    expect(screen.getByLabelText("Buscar por nombre o código")).toHaveValue("SKU-001");
    expect(screen.getByText("Agrega prendas para iniciar la venta.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(screen.getByRole("button", { name: "Proceder al cobro" })).toBeEnabled();
  });

  it("confirms a global discount in pesos and sends the net payment", async () => {
    const create = vi.spyOn(api, "createSale").mockResolvedValue(sale);
    render(<SalesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Escanear código" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    fireEvent.click(screen.getByRole("button", { name: "Proceder al cobro" }));
    expect(screen.getByLabelText("Descuento global (COP)")).toHaveValue(0);
    fireEvent.change(screen.getByLabelText("Descuento global (COP)"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y continuar" }));
    fireEvent.click(screen.getByRole("button", { name: /Pago exacto/ }));
    expect(screen.getByLabelText("Efectivo recibido")).toHaveValue(80000);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar venta/ }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("test-token", { items: [{ product_id: product.id, quantity: 1 }], cash_received_cop: 80000, global_discount_cop: 5000 }, expect.any(String)));
  });

  it("applies the discount to every unit and skips global discounts when a line is discounted", async () => {
    const create = vi.spyOn(api, "createSale").mockResolvedValue(sale);
    render(<SalesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Escanear código" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    fireEvent.click(screen.getByRole("button", { name: /Descuento de Camisa azul/ }));
    fireEvent.change(screen.getByLabelText("Descuento por unidad (COP)"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar descuento" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar una unidad de Camisa azul" }));
    fireEvent.click(screen.getByRole("button", { name: "Proceder al cobro" }));
    expect(screen.queryByLabelText("Descuento global (COP)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pago exacto/ }));
    expect(screen.getByLabelText("Efectivo recibido")).toHaveValue(160000);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar venta/ }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("test-token", { items: [{ product_id: product.id, quantity: 2, unit_discount_cop: 5000 }], cash_received_cop: 160000 }, expect.any(String)));
  });

  it("removing and readding a garment resets its discount to zero", async () => {
    render(<SalesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Escanear código" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    fireEvent.click(screen.getByRole("button", { name: /Descuento de Camisa azul/ }));
    fireEvent.change(screen.getByLabelText("Descuento por unidad (COP)"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar descuento" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitar una unidad de Camisa azul" }));
    fireEvent.click(screen.getByRole("button", { name: "Escanear código" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    fireEvent.click(screen.getByRole("button", { name: /Descuento de Camisa azul/ }));
    expect(screen.getByLabelText("Descuento por unidad (COP)")).toHaveValue(0);
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
