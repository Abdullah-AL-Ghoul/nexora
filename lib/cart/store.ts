import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Client cart — display cache only. Prices, stock, and totals always come
 * from the server via POST /api/cart/quote (M17 / Phase 4 spec).
 */

export type StoredCartItem = {
  productId: string;
  variantId: string | null;
  qty: number;
};

export type CartStore = {
  items: StoredCartItem[];
  couponCode: string | null;
  _hasHydrated: boolean;
  isDrawerOpen: boolean;
  addItem: (item: StoredCartItem) => void;
  setQty: (productId: string, variantId: string | null, qty: number) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  clear: () => void;
  setCoupon: (code: string | null) => void;
  setHydrated: (value: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

function sameLine(item: StoredCartItem, productId: string, variantId: string | null): boolean {
  return item.productId === productId && (item.variantId ?? null) === variantId;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      couponCode: null,
      _hasHydrated: false,
      isDrawerOpen: false,

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

      addItem: (incoming) =>
        set((state) => {
          const existing = state.items.find((item) =>
            sameLine(item, incoming.productId, incoming.variantId)
          );
          if (existing) {
            return {
              items: state.items.map((item) =>
                sameLine(item, incoming.productId, incoming.variantId)
                  ? { ...item, qty: Math.min(99, item.qty + incoming.qty) }
                  : item
              ),
            };
          }
          return { items: [...state.items, incoming] };
        }),

      setQty: (productId, variantId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((item) => !sameLine(item, productId, variantId))
              : state.items.map((item) =>
                  sameLine(item, productId, variantId)
                    ? { ...item, qty: Math.min(99, qty) }
                    : item
                ),
        })),

      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter((item) => !sameLine(item, productId, variantId)),
        })),

      clear: () => set({ items: [], couponCode: null }),
      setCoupon: (code) => set({ couponCode: code }),
      setHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: "nexora-cart-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, couponCode: state.couponCode }),
      // Rehydration is triggered manually after mount (see CartHydration) to
      // keep server and first-client renders identical (no hydration mismatch).
      skipHydration: true,
    }
  )
);

/** Total item count for the header badge (0 until rehydrated). */
export function selectCartCount(items: StoredCartItem[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}
