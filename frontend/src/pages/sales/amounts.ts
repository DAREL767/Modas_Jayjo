import type { Product } from "../../api/types";

export type CartItem = { product: Product; quantity: number; unitDiscountCop: number };

export function saleAmounts(cart: CartItem[], globalDiscountCop = 0) {
  const subtotal = cart.reduce((sum, item) => sum + item.product.unit_price_cop * item.quantity, 0);
  const lineDiscount = cart.reduce((sum, item) => sum + item.unitDiscountCop * item.quantity, 0);
  const discount = lineDiscount + globalDiscountCop;
  return { subtotal, lineDiscount, discount, total: subtotal - discount };
}
