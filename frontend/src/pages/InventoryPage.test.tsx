import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  fireEvent.click(screen.getByRole("button", { name: "Escanear SKU de nueva prenda" }));
  expect(screen.getByLabelText("SKU")).toHaveValue("NEW-001");
});
