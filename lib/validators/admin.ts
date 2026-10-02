import { z } from "zod";

/**
 * Admin mutation schemas — all `.strict()`. Prices/stock/status changes go
 * through these before touching the database.
 */

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(140)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value), "Invalid slug format");

export const productCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    description: z.string().trim().min(5).max(5000),
    price: z.number().int().min(0).max(10_000_000),
    compareAtPrice: z.number().int().min(0).max(10_000_000).nullish(),
    sku: z.string().trim().min(2).max(64),
    stock: z.number().int().min(0).max(1_000_000),
    brand: z.string().trim().max(60).nullish(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    categoryId: z.string().trim().min(1).max(40),
    imageUrl: z.string().trim().max(500).nullish(),
  })
  .strict();

/** Editable fields only — slug and SKU are immutable (URLs + stock identity). */
export const productPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(5).max(5000),
    price: z.number().int().min(0).max(10_000_000),
    compareAtPrice: z.number().int().min(0).max(10_000_000).nullish(),
    stock: z.number().int().min(0).max(1_000_000),
    brand: z.string().trim().max(60).nullish(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    categoryId: z.string().trim().min(1).max(40),
    imageUrl: z.string().trim().max(500).nullish(),
  })
  .strict();

export const inventoryAdjustSchema = z
  .object({
    productId: z.string().trim().min(1).max(40),
    delta: z.number().int().min(-100_000).max(100_000).refine((n) => n !== 0, "Delta cannot be zero"),
    reason: z.enum(["RESTOCK", "ADJUSTMENT"]),
    note: z.string().trim().max(200).nullish(),
  })
  .strict();

export const orderStatusSchema = z
  .object({
    status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]),
  })
  .strict();

export const userUpdateSchema = z
  .object({
    role: z.enum(["CUSTOMER", "MANAGER", "ADMIN"]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.role !== undefined || value.isActive !== undefined, {
    message: "Nothing to update",
  });

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;
export type InventoryAdjustInput = z.infer<typeof inventoryAdjustSchema>;
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
