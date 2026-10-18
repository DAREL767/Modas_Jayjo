import { requestJson } from "./client";
import type {
  CashSession,
  Product,
  ProductCreate,
  ProductUpdate,
  Sale,
  SaleRequest,
  TokenResponse,
  User,
  UserCreate,
  UserUpdate,
} from "./types";

export const api = {
  googleLogin: (credential: string, link?: { username: string; password: string }) =>
    requestJson<TokenResponse>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential, ...link }),
    }),
  currentUser: (token: string) => requestJson<User>("/api/auth/me", {}, token),
  inventory: (token: string, activeOnly = true) =>
    requestJson<Product[]>(`/api/inventory/?active_only=${activeOnly}`, {}, token),
  createProduct: (token: string, product: ProductCreate) =>
    requestJson<Product>(
      "/api/inventory/",
      { method: "POST", body: JSON.stringify(product) },
      token,
    ),
  updateProduct: (token: string, id: string, changes: ProductUpdate) =>
    requestJson<Product>(
      `/api/inventory/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(changes) },
      token,
    ),
  adjustStock: (token: string, id: string, delta: number, reason: string) =>
    requestJson<{ product: Product; delta: number; reason: string }>(
      `/api/inventory/${encodeURIComponent(id)}/stock-adjustments`,
      { method: "POST", body: JSON.stringify({ delta, reason }) },
      token,
    ),
  createSale: (token: string, sale: SaleRequest, idempotencyKey: string) =>
    requestJson<Sale>(
      "/api/sales/",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(sale),
      },
      token,
    ),
  currentCashSession: (token: string) =>
    requestJson<CashSession | null>("/api/cash-register/current", {}, token),
  openCashSession: (token: string, opening_cash_cop: number, note?: string) =>
    requestJson<CashSession>(
      "/api/cash-register/open",
      { method: "POST", body: JSON.stringify({ opening_cash_cop, note }) },
      token,
    ),
  closeCashSession: (
    token: string,
    counted_by_payment_cop: Record<"cash" | "card" | "transfer", number>,
    note?: string,
  ) =>
    requestJson<CashSession>(
      "/api/cash-register/close",
      { method: "POST", body: JSON.stringify({ counted_by_payment_cop, note }) },
      token,
    ),
  users: (token: string) => requestJson<User[]>("/api/users/", {}, token),
  createUser: (token: string, user: UserCreate) =>
    requestJson<User>("/api/users/", { method: "POST", body: JSON.stringify(user) }, token),
  updateUser: (token: string, id: string, changes: UserUpdate) =>
    requestJson<User>(
      `/api/users/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(changes) },
      token,
    ),
  deactivateUser: (token: string, id: string) =>
    requestJson<void>(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
};
