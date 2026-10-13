import { describe, expect, it } from "vitest";
import { formatCurrencyPrice, CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currency";

describe("formatCurrencyPrice", () => {
  it("formats USD cents accurately as default", () => {
    expect(formatCurrencyPrice(10000)).toBe("$100.00");
    expect(formatCurrencyPrice(250000, "USD")).toBe("$2,500.00");
  });

  it("converts and formats EUR with European currency symbols", () => {
    // 10000 cents = $100 * 0.92 = 92.00 €
    const result = formatCurrencyPrice(10000, "EUR");
    expect(result).toContain("92,00");
    expect(result).toContain("€");
  });

  it("converts and formats GBP with pound symbols", () => {
    // 10000 cents = $100 * 0.79 = £79.00
    const result = formatCurrencyPrice(10000, "GBP");
    expect(result).toContain("79.00");
    expect(result).toContain("£");
  });

  it("converts and formats AED without fractional decimals", () => {
    // 10000 cents = $100 * 3.6725 = 367 AED
    const result = formatCurrencyPrice(10000, "AED");
    expect(result).toBe("367 AED");
  });

  it("converts and formats SAR without fractional decimals", () => {
    // 10000 cents = $100 * 3.75 = 375 SAR
    const result = formatCurrencyPrice(10000, "SAR");
    expect(result).toBe("375 SAR");
  });

  it("falls back to USD configuration gracefully if unknown currency is passed", () => {
    // @ts-expect-error testing invalid currency code
    const result = formatCurrencyPrice(10000, "UNKNOWN");
    expect(result).toBe("$100.00");
  });
});
