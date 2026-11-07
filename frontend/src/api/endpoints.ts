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

async function listAll<T>(path: string, token: string): Promise<T[]> {
  const items: T[] = [];
  const separator = path.includes("?") ? "&" : "?";
  for (let skip = 0; ; skip += 100) {
    const page = await requestJson<T[]>(`${path}${separator}skip=${skip}&limit=100`, {}, token);
    items.push(...page);
    if (page.length < 100) return items;
  }
}

export const api = {
  googleLogin: (credential: string, link?: { username: string; password: string }) =>
    requestJson<TokenResponse>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential, ...link }),
    }),
  currentUser: (token: string) => requestJson<User>("/api/auth/me", {}, token),
  inventory: (token: string, activeOnly = true) =>
    listAll<Product>(`/api/inventory/?active_only=${activeOnly}`, token),
  productPhoto: (token: string, id: string, signal?: AbortSignal) =>
    requestJson<{ photo: string | null }>(`/api/inventory/${encodeURIComponent(id)}/photo`, { signal }, token),
  deleteProduct: (token: string, id: string) =>
    requestJson<void>(`/api/inventory/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
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
  closeCashSession: (token: string, counted_cash_cop: number, note?: string) =>
    requestJson<CashSession>(
      "/api/cash-register/close",
      { method: "POST", body: JSON.stringify({ counted_cash_cop, note }) },
      token,
    ),
  cashHistory: (token: string, startDate: string, endDate: string) =>
    requestJson<CashSession[]>(
      `/api/cash-register/history?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
      {},
      token,
    ),
  users: (token: string) => listAll<User>("/api/users/", token),
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
