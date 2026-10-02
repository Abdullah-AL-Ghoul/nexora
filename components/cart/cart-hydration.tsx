"use client";

import { useEffect } from "react";

import { useCartStore } from "@/lib/cart/store";

/**
 * Rehydrates the persisted cart once after mount. Doing it in an effect
 * (instead of eagerly) keeps server and first-client renders identical,
 * avoiding hydration mismatches.
 */
export function CartHydration() {
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(useCartStore.persist.rehydrate()).then(() => {
      if (!cancelled) useCartStore.getState().setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
