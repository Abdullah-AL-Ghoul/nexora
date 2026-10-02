import { z } from "zod";

/**
 * Cart / wishlist request schemas. `.strict()` is intentional: clients must
 * never be able to smuggle price/total fields — the server is the only
 * source of truth for money.
 */

export const cartItemSchema = z
  .object({
    productId: z.string().min(1).max(40),
    variantId: z.string().min(1).max(40).nullish(),
    qty: z.number().int().min(1).max(99),
  })
  .strict();

export const cartItemsSchema = z.array(cartItemSchema).min(1).max(50);

export const quoteRequestSchema = z
  .object({
    items: cartItemsSchema,
  })
  .strict();

export const couponValidateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z0-9_-]+$/.test(value), "Invalid coupon code format"),
    items: cartItemsSchema,
  })
  .strict();

export const wishlistRequestSchema = z
  .object({
    productId: z.string().min(1).max(40),
    action: z.enum(["add", "remove"]),
  })
  .strict();

export type CartItemInput = z.infer<typeof cartItemSchema>;
