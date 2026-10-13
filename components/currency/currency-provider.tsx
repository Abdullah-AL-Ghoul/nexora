"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";
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

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedCurrency | null;
      if (saved && saved in CURRENCIES) {
        setCurrencyState(saved);
      }
    } catch {
      // Storage unavailable or disabled
    }
  }, []);

  const setCurrency = (nextCurrency: SupportedCurrency) => {
    startTransition(() => {
      setCurrencyState(nextCurrency);
      try {
        localStorage.setItem(STORAGE_KEY, nextCurrency);
      } catch {
        // Storage unavailable
      }
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
