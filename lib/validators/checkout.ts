import { z } from "zod";

import { cartItemsSchema, couponCodeSchema } from "@/lib/validators/cart";

/**
 * Checkout request schemas. `.strict()` — clients can never smuggle money
 * fields (price/total/discount); the server recomputes every cent.
 */

export const addressSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    line1: z.string().trim().min(3).max(120),
    line2: z.string().trim().max(120).nullish(),
    city: z.string().trim().min(1).max(60),
    region: z.string().trim().max(60).nullish(),
    postalCode: z.string().trim().min(3).max(16),
    country: z.string().trim().min(2).max(56),
    // Optional; empty string is allowed here and normalized to null on save.
    phone: z.union([z.string().trim().min(5).max(32), z.literal("")]).nullish(),
  })
  .strict();

export const checkoutSchema = z
  .object({
    items: cartItemsSchema,
    shippingMethod: z.enum(["standard", "express"]),
    address: addressSchema,
    couponCode: couponCodeSchema.nullish(),
    notes: z.string().trim().max(500).nullish(),
    // Client-generated per submit attempt — server dedupes duplicate orders.
    idempotencyKey: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .nullish(),
  })
  .strict();

/** What the checkout form collects — flat fields (items come from the cart). */
export const checkoutFormSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required").max(80),
    line1: z.string().trim().min(3, "Address is required").max(120),
    line2: z.string().trim().max(120).nullish(),
    city: z.string().trim().min(1, "City is required").max(60),
    region: z.string().trim().max(60).nullish(),
    postalCode: z.string().trim().min(3, "Postal code is required").max(16),
    country: z.string().trim().min(2, "Country is required").max(56),
    phone: z.union([z.string().trim().min(5, "Phone looks too short").max(32), z.literal("")]).nullish(),
    shippingMethod: z.enum(["standard", "express"]),
    notes: z.string().trim().max(500).nullish(),
  })
  .strict();

/** Body for the mock payment endpoint (local/dev only). */
export const mockPaySchema = z
  .object({
    orderId: z.string().min(1).max(40),
  })
  .strict();

export type AddressInput = z.infer<typeof addressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutFormInput = z.infer<typeof checkoutFormSchema>;
