"use client";

import React, { createContext, useContext, useTransition } from "react";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  formatCurrencyPrice,
  type SupportedCurrency,
} from "@/lib/currency";

interface CurrencyContextValue {
  currency: SupportedCurrency;
  setCurrency: (currency: SupportedCurrency) => void;
  formatPrice: (centsUSD: number) => string;
  isPending: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
  formatPrice: (centsUSD) => formatCurrencyPrice(centsUSD, DEFAULT_CURRENCY),
  isPending: false,
});

const STORAGE_KEY = "nexora_selected_currency";
const listeners = new Set<() => void>();

function emitCurrencyChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): SupportedCurrency {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedCurrency | null;
    if (saved && saved in CURRENCIES) return saved;
  } catch {
    // Storage unavailable
  }
  return DEFAULT_CURRENCY;
}

function getServerSnapshot(): SupportedCurrency {
  return DEFAULT_CURRENCY;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const currency = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isPending, startTransition] = useTransition();

  const setCurrency = (nextCurrency: SupportedCurrency) => {
    startTransition(() => {
      try {
        localStorage.setItem(STORAGE_KEY, nextCurrency);
      } catch {
        // Storage unavailable
      }
      emitCurrencyChange();
    });
  };

  const formatPrice = (centsUSD: number) => {
    return formatCurrencyPrice(centsUSD, currency);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        formatPrice,
        isPending,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    return {
      currency: DEFAULT_CURRENCY,
      setCurrency: () => {},
      formatPrice: (centsUSD: number) => formatCurrencyPrice(centsUSD, DEFAULT_CURRENCY),
      isPending: false,
    };
  }
  return context;
}
