import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { api } from "../api/endpoints";
import { AuthProvider, useAuth } from "./AuthProvider";

vi.mock("@react-oauth/google", () => ({ googleLogout: vi.fn() }));
vi.mock("../api/endpoints", () => ({ api: { googleLogin: vi.fn(), currentUser: vi.fn() } }));

const user = { id: "u1", username: "ana", email: "ana@example.com", full_name: "Ana", role: "vendor" as const, is_active: true };

function AuthHarness() {
  const auth = useAuth();
  return <div>
    <span>{auth.linkRequired ? "link-required" : auth.user ? "authenticated" : "signed-out"}</span>
    <button onClick={() => void auth.signInWithGoogle("google-id-token")}>google</button>
    <button onClick={() => void auth.completeAccountLink("ana", "temporary-password")}>link</button>
  </div>;
}

describe("AuthProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the Google credential in memory while linking and exchanges it with the authorized account", async () => {
    vi.mocked(api.googleLogin)
      .mockRejectedValueOnce(new ApiError(428, "Cuenta pendiente de vinculación"))
      .mockResolvedValueOnce({ access_token: "api-session-token", token_type: "bearer" });
    vi.mocked(api.currentUser).mockResolvedValue(user);
    const localStorageWrite = vi.spyOn(Storage.prototype, "setItem");
    const sessionStorageWrite = vi.spyOn(Storage.prototype, "setItem");
    render(<AuthProvider><AuthHarness /></AuthProvider>);

    fireEvent.click(screen.getByRole("button", { name: "google" }));
    await waitFor(() => expect(screen.getByText("link-required")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "link" }));
    await waitFor(() => expect(screen.getByText("authenticated")).toBeInTheDocument());

    expect(api.googleLogin).toHaveBeenNthCalledWith(2, "google-id-token", { username: "ana", password: "temporary-password" });
    expect(api.currentUser).toHaveBeenCalledWith("api-session-token");
    expect(localStorageWrite).not.toHaveBeenCalled();
    expect(sessionStorageWrite).not.toHaveBeenCalled();
  });
});
