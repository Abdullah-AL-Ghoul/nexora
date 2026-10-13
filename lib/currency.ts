export type SupportedCurrency = "USD" | "EUR" | "GBP" | "AED" | "SAR";

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  rate: number; // multiplier from base USD
  decimals: number;
}

export const CURRENCIES: Record<SupportedCurrency, CurrencyConfig> = {
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    rate: 1.0,
    decimals: 2,
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    rate: 0.92,
    decimals: 2,
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    rate: 0.79,
    decimals: 2,
  },
  AED: {
    code: "AED",
    symbol: "AED",
    name: "UAE Dirham",
    rate: 3.6725,
    decimals: 0,
  },
  SAR: {
    code: "SAR",
    symbol: "SAR",
    name: "Saudi Riyal",
    rate: 3.75,
    decimals: 0,
  },
};

export const DEFAULT_CURRENCY: SupportedCurrency = "USD";

/**
 * Formats a USD cents amount into the selected currency.
 */
export function formatCurrencyPrice(
  centsUSD: number,
  currencyCode: SupportedCurrency = DEFAULT_CURRENCY
): string {
  const config = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const convertedAmount = (centsUSD / 100) * config.rate;

  if (currencyCode === "AED") {
    return `${Math.round(convertedAmount).toLocaleString("en-US")} AED`;
  }
  if (currencyCode === "SAR") {
    return `${Math.round(convertedAmount).toLocaleString("en-US")} SAR`;
  }

  return new Intl.NumberFormat(currencyCode === "EUR" ? "de-DE" : "en-US", {
    style: "currency",
    currency: config.code,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(convertedAmount);
}
