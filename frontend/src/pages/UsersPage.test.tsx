import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../api/endpoints";
import { UsersPage } from "./UsersPage";

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ accessToken: "token", user: { id: "admin" } }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("reactivates an inactive account and refreshes its actions", async () => {
  const member = { id: "vendor", username: "vendor", email: "vendor@example.com", full_name: "Vendedora", role: "vendor" as const, is_active: false };
  vi.spyOn(api, "users").mockResolvedValueOnce([member]).mockResolvedValue([{ ...member, is_active: true }]);
  const update = vi.spyOn(api, "updateUser").mockResolvedValue({ ...member, is_active: true });
  render(<UsersPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Reactivar" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("token", "vendor", { is_active: true }));
  expect(await screen.findByRole("button", { name: "Desactivar" })).toBeInTheDocument();
  expect(screen.getByText("Activa")).toBeInTheDocument();
});
