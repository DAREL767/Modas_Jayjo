import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { api } from "../api/endpoints";

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ accessToken: "token" }) }));
const metrics = { date: "2026-11-19", sales_total_cop: 45000, units_sold: 3, low_stock_count: 2 };
beforeEach(() => vi.spyOn(api, "dashboardMetrics").mockResolvedValue(metrics));

const baseUser = { id: "u1", username: "ana", email: "ana@example.com", full_name: "Ana", is_active: true };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("DashboardPage role permissions", () => {
  it("shows only sales and inventory to a vendor", () => {
    render(<DashboardPage user={{ ...baseUser, role: "vendor" }} onNavigate={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Nueva Venta (POS)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inventario de Prendas" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cierre de Caja Diario" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Personal Autorizado" })).not.toBeInTheDocument();
  });

  it("shows admin modules", () => {
    render(<DashboardPage user={{ ...baseUser, role: "admin" }} section="administration" onNavigate={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Cierre de Caja Diario" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personal Autorizado" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gestión y Finanzas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver reportes" })).toBeEnabled();
    expect(screen.getByText("Actualización cada 10 s")).toBeInTheDocument();
  });

  it("keeps operational modules available to administrators", () => {
    const navigate = vi.fn();
    render(<DashboardPage user={{ ...baseUser, role: "admin" }} onNavigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar venta" }));
    expect(navigate).toHaveBeenCalledWith("sales");
    fireEvent.click(screen.getByRole("button", { name: "Ver inventario" }));
    expect(navigate).toHaveBeenCalledWith("inventory");
  });

  it("does not expose administration if a vendor receives that section", () => {
    render(<DashboardPage user={{ ...baseUser, role: "vendor" }} section="administration" onNavigate={vi.fn()} />);
    expect(screen.queryByText("Gestión del negocio")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar venta" })).toBeInTheDocument();
  });

  it("connects administrative cards to existing modules", () => {
    const navigate = vi.fn();
    render(<DashboardPage user={{ ...baseUser, role: "admin" }} section="administration" onNavigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Administrar inventario" }));
    expect(navigate).toHaveBeenLastCalledWith("inventory");
    fireEvent.click(screen.getByRole("button", { name: "Realizar arqueo" }));
    expect(navigate).toHaveBeenLastCalledWith("cash");
    fireEvent.click(screen.getByRole("button", { name: "Gestionar personal" }));
    expect(navigate).toHaveBeenLastCalledWith("users");
  });

  it("updates real metrics every ten seconds and opens the stock alerts", async () => {
    vi.useFakeTimers();
    const onLowStock = vi.fn();
    await act(async () => { render(<DashboardPage user={{ ...baseUser, role: "admin" }} section="administration" onNavigate={vi.fn()} onLowStock={onLowStock} />); });
    expect(screen.getByRole("button", { name: "Ver prendas con stock bajo" })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Ver detalle de prendas vendidas" })).toHaveTextContent("3");
    vi.mocked(api.dashboardMetrics).mockResolvedValue({ ...metrics, units_sold: 5, low_stock_count: 1 });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(screen.getByRole("button", { name: "Ver prendas con stock bajo" })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Ver detalle de prendas vendidas" })).toHaveTextContent("5");
    fireEvent.click(screen.getByRole("button", { name: "Ver prendas con stock bajo" }));
    expect(onLowStock).toHaveBeenCalledOnce();
  });
});
