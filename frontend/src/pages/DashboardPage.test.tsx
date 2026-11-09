import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

const baseUser = { id: "u1", username: "ana", email: "ana@example.com", full_name: "Ana", is_active: true };
afterEach(cleanup);

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
    expect(screen.getAllByText("Sin datos disponibles")).toHaveLength(3);
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
});
