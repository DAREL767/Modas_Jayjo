import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../api/endpoints";
import { InventoryPage } from "./InventoryPage";

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ accessToken: "token", user: { role: "vendor" } }) }));
vi.mock("../components/CameraScanner", () => ({ CameraScanButton: ({ label, onDetected }: { label: string; onDetected: (code: string) => void }) => <button type="button" onClick={() => onDetected(label.includes("nueva") ? "NEW-001" : "SKU-001")}>{label}</button> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("uses scanned codes for an exact inventory lookup and for a new product SKU", async () => {
  const product = { id: "1", sku: "SKU-001", name: "Jean niño", category: "Jeans", size: "M", color: "Azul", stock_quantity: 2, unit_price_cop: 20000, low_stock_threshold: 0, is_active: true, created_at: "", updated_at: "" };
  vi.spyOn(api, "inventory").mockResolvedValue([product, { ...product, id: "2", sku: "SKU-0010", name: "Otra prenda" }]);
  render(<InventoryPage />);
  await screen.findByText("Jean niño");
  fireEvent.click(screen.getByRole("button", { name: "Escanear para buscar" }));
  expect(screen.getByText("Jean niño")).toBeInTheDocument();
  expect(screen.queryByText("Otra prenda")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("SKU")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Agregar prenda" }));
  expect(screen.queryByRole("button", { name: "Escanear para buscar" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Escanear SKU de nueva prenda" }));
  expect(screen.getByLabelText("SKU")).toHaveValue("NEW-001");
  fireEvent.click(screen.getByRole("button", { name: /Volver al inventario/ }));
  expect(screen.queryByLabelText("SKU")).not.toBeInTheDocument();
  expect(screen.getByText("Jean niño")).toBeInTheDocument();
});

it("opens Cambios from vendor inventory and selects the damaged variant directly", async () => {
  const product = { id: "1", sku: "SKU-001", name: "Jean niño", category: "Jeans", size: "M", color: "Azul", stock_quantity: 2, unit_price_cop: 20000, low_stock_threshold: 0, is_active: true, created_at: "", updated_at: "" };
  vi.spyOn(api, "inventory").mockResolvedValue([product, { ...product, id: "2", sku: "SKU-002", size: "L" }]);
  render(<InventoryPage />);
  await screen.findByRole("button", { name: "Agregar prenda" });
  fireEvent.click(screen.getByRole("button", { name: "Cambios" }));
  fireEvent.change(screen.getByLabelText("Buscar prenda dañada"), { target: { value: "SKU-002" } });
  fireEvent.click(await screen.findByRole("button", { name: /Jean niño · SKU-002 · L/ }));
  expect(screen.queryByRole("button", { name: /SKU-001/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Descripción del daño"), { target: { value: "Costura abierta" } });
  expect(screen.getByRole("button", { name: "Enviar solicitud" })).toBeEnabled();
});

it("uses the chosen line from a multi-item sale for the exchange", async () => {
  const replacement = { id: "3", sku: "SKU-003", name: "Reemplazo", category: "Jeans", size: "L", color: "Azul", stock_quantity: 2, unit_price_cop: 20000, low_stock_threshold: 0, is_active: true, created_at: "", updated_at: "" };
  const lines = [
    { product_id: "1", sku: "SKU-001", name: "Primera prenda", size: "M", color: "Azul", remaining: 1, credit_cop: 10000 },
    { product_id: "2", sku: "SKU-002", name: "Segunda prenda", size: "S", color: "Negro", remaining: 1, credit_cop: 12000 },
  ];
  vi.spyOn(api, "inventory").mockResolvedValue([replacement]);
  vi.spyOn(api, "saleHistory").mockResolvedValue([{
    sale_id: "venta-original", status: "completed", created_at: "2026-11-09T15:00:00Z",
    items: lines.map((line) => ({ ...line, quantity: 1, unit_price_cop: line.credit_cop, line_total_cop: line.credit_cop })),
    total_cop: 22000, cash_received_cop: 22000, change_cop: 0,
  }]);
  vi.spyOn(api, "returnLines").mockResolvedValue(lines);
  const create = vi.spyOn(api, "createChange").mockImplementation(async (_token, body, id) => ({
    ...body, id, status: "pending", product: lines[1], credit_cop: 12000,
    replacement_price_cop: 20000, difference_cop: 8000, created_at: "2026-11-09T15:00:00Z",
  }));
  render(<InventoryPage />);
  fireEvent.click(screen.getByRole("button", { name: "Cambios" }));
  fireEvent.change(screen.getByLabelText(/Tipo de novedad/), { target: { value: "exchange" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar ventas" }));
  fireEvent.click(await screen.findByRole("button", { name: "Elegir esta venta" }));
  fireEvent.click(await screen.findByRole("button", { name: /Segunda prenda · SKU-002/ }));
  fireEvent.change(screen.getByLabelText("Buscar prenda que se entrega"), { target: { value: "SKU-003" } });
  fireEvent.click(await screen.findByRole("button", { name: /Reemplazo · SKU-003/ }));
  fireEvent.change(screen.getByLabelText("Motivo del cambio"), { target: { value: "Talla distinta" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
  await waitFor(() => expect(create).toHaveBeenCalledWith("token", {
    kind: "exchange", sale_id: "venta-original", product_id: "2", replacement_id: "3", reason: "Talla distinta",
  }, expect.any(String)));
});
