export type UserRole = "admin" | "vendor";

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  size: string;
  color: string;
  unit_price_cop: number;
  unit_cost_cop?: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  sku: string;
  name: string;
  category: string;
  size: string;
  color: string;
  unit_price_cop: number;
  unit_cost_cop?: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
}

export interface ProductUpdate {
  sku?: string;
  name?: string;
  category?: string;
  size?: string;
  color?: string;
  unit_price_cop?: number;
  unit_cost_cop?: number | null;
  low_stock_threshold?: number;
  is_active?: boolean;
}

export interface SaleRequest {
  items: Array<{ product_id: string; quantity: number }>;
  cash_received_cop: number;
}

export interface SaleLine {
  product_id: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price_cop: number;
  line_total_cop: number;
}

export interface Sale {
  sale_id: string;
  status: "completed";
  items: SaleLine[];
  total_cop: number;
  cash_received_cop: number;
  change_cop: number;
  cashier_id: string;
  cash_session_id: string;
  idempotency_key: string;
  created_at: string;
}

export interface CashSession {
  id: string;
  status: "open" | "closed";
  opening_cash_cop: number;
  sales_cash_cop: number;
  expected_cash_cop?: number | null;
  counted_cash_cop?: number | null;
  difference_cash_cop?: number | null;
  opened_by: string;
  closed_by?: string | null;
  opened_at: string;
  closed_at?: string | null;
  opening_note?: string | null;
  closing_note?: string | null;
}

export interface UserCreate {
  username: string;
  email: string;
  full_name: string;
  password: string;
  role: UserRole;
}

export interface UserUpdate {
  username?: string;
  email?: string;
  full_name?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
}
