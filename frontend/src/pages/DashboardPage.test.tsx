import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

const baseUser = { id: "u1", username: "ana", email: "ana@example.com", full_name: "Ana", is_active: true };

describe("DashboardPage role permissions", () => {
  it("shows only sales and inventory to a vendor", () => {
    render(<DashboardPage user={{ ...baseUser, role: "vendor" }} onNavigate={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Nueva Venta (POS)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inventario de Prendas" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cierre de Caja Diario" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Personal Autorizado" })).not.toBeInTheDocument();
  });

  it("shows admin modules", () => {
    render(<DashboardPage user={{ ...baseUser, role: "admin" }} onNavigate={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Cierre de Caja Diario" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personal Autorizado" })).toBeInTheDocument();
  });
});
