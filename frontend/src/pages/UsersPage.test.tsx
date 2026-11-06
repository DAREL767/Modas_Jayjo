import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../api/endpoints";
import { UsersPage } from "./UsersPage";

const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ accessToken: "token", user: { id: "admin" }, signOut: auth.signOut }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each([false, true])("edits credentials and signs out only when editing self (%s)", async (self) => {
  const member = { id: self ? "admin" : "vendor", username: "member", email: "member@example.com", full_name: "Persona", role: "admin" as const, is_active: true };
  auth.signOut.mockClear();
  vi.spyOn(api, "users").mockResolvedValue([member]);
  const update = vi.spyOn(api, "updateUser").mockResolvedValue(member);
  render(<UsersPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
  fireEvent.change(screen.getByLabelText("Correo de la cuenta"), { target: { value: "nuevo@example.com" } });
  fireEvent.change(screen.getByLabelText("Nueva contraseña (opcional)"), { target: { value: "new-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("token", member.id, { email: "nuevo@example.com", password: "new-password" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(auth.signOut).toHaveBeenCalledTimes(self ? 1 : 0);
});

it("sends only changed profile fields and preserves the current password", async () => {
  const member = { id: "vendor", username: "member", email: "member@example.com", full_name: "Persona", role: "vendor" as const, is_active: true };
  vi.spyOn(api, "users").mockResolvedValue([member]);
  const update = vi.spyOn(api, "updateUser").mockResolvedValue(member);
  render(<UsersPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
  fireEvent.change(screen.getByLabelText("Nombre completo de la cuenta"), { target: { value: "Nuevo nombre" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("token", "vendor", { full_name: "Nuevo nombre" }));
});

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
