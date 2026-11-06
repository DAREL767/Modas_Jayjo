import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const auth = vi.hoisted(() => ({ user: { id: "admin", role: "admin", full_name: "Sandra Pérez" }, signOut: vi.fn() }));
vi.mock("./auth/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("./pages/InventoryPage", () => ({ InventoryPage: () => <p>Contenido inventario</p> }));
vi.mock("./pages/CashRegisterPage", () => ({ CashRegisterPage: () => <p>Contenido caja</p> }));
vi.mock("./pages/UsersPage", () => ({ UsersPage: () => <p>Contenido personal</p> }));
vi.mock("./pages/SalesPage", () => ({ SalesPage: () => <p>Contenido ventas</p> }));
afterEach(() => { cleanup(); auth.user.role = "admin"; });

describe("workspace navigation", () => {
  it("switches areas and returns to the originating dashboard", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Operación" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Administración" }));
    fireEvent.click(screen.getByRole("button", { name: "Realizar arqueo" }));
    expect(screen.getByText("Contenido caja")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Volver al inicio/ }));
    expect(screen.getByRole("heading", { name: "Gestión del negocio" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Operación" }));
    expect(screen.getByRole("button", { name: "Iniciar venta" })).toBeInTheDocument();
  });

  it("gives vendors a direct operational dashboard without an admin switch", () => {
    auth.user.role = "vendor";
    render(<App />);
    expect(screen.queryByRole("navigation", { name: "Áreas de trabajo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar venta" })).toBeInTheDocument();
    expect(screen.getByText("Hola, Sandra")).toBeInTheDocument();
  });
});
