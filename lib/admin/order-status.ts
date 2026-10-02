import type { OrderStatus } from "@/lib/generated/prisma/enums";

/**
 * Staff-driven order status transitions. Payment (PENDING → SUCCEEDED) and
 * the initial PAID state are webhook/mock only — staff move orders forward
 * (or cancel/refund) from here.
 */

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Terminal states that return paid stock to inventory. */
export function restockOn(to: OrderStatus): to is "CANCELLED" | "REFUNDED" {
  return to === "CANCELLED" || to === "REFUNDED";
}
