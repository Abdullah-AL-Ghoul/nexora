"use client";

import { CURRENCIES, type SupportedCurrency } from "@/lib/currency";
import { useCurrency } from "@/components/currency/currency-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe, ChevronDown, Check } from "lucide-react";
import { cn } from "cn";

export function CurrencySelector({
  variant = "subtle",
  className,
}: {
  variant?: "subtle" | "outline" | "ghost";
  className?: string;
}) {
  const { currency, setCurrency } = useCurrency();
  const current = CURRENCIES[currency] || CURRENCIES.USD;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === "subtle" ? "ghost" : variant}
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 text-xs font-medium tracking-tight text-muted-foreground hover:text-foreground",
            variant === "subtle" && "hover:bg-muted/60",
            className
          )}
          aria-label={`Select currency, currently ${current.code}`}
        >
          <Globe className="size-3.5 opacity-70" aria-hidden="true" />
          <span className="font-semibold uppercase tracking-wider">{current.code}</span>
          <span className="text-[10px] text-muted-foreground">({current.symbol})</span>
          <ChevronDown className="size-3 opacity-50" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 p-1">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Regional Currency
        </div>
        {(Object.keys(CURRENCIES) as SupportedCurrency[]).map((code) => {
          const item = CURRENCIES[code];
          const isSelected = item.code === currency;
          return (
            <DropdownMenuItem
              key={code}
              onClick={() => setCurrency(code)}
              className={cn(
                "flex items-center justify-between text-xs cursor-pointer py-1.5",
                isSelected && "font-semibold text-primary bg-primary/5"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 font-mono font-medium text-[11px] text-muted-foreground">
                  {item.symbol}
                </span>
                <span>{item.name}</span>
              </div>
              {isSelected && <Check className="size-3 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
