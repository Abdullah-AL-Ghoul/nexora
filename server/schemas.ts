import { z } from 'zod';

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ProductFilterSchema = PaginationSchema.extend({
  categorySlug: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['newest', 'price-asc', 'price-desc', 'popular', 'rating']).optional(),
  inStockOnly: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  featuredOnly: z.boolean().optional(),
});

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  tagline: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  sku: z.string().min(1).max(50).optional(),
  stock: z.number().int().min(0).optional(),
  categoryId: z.string().min(1),
  images: z.array(z.object({
    id: z.string(),
    url: z.string().url(),
    altText: z.string(),
    isPrimary: z.boolean(),
    order: z.number().int(),
  })).optional(),
  variants: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    sku: z.string(),
    price: z.number().positive(),
    stock: z.number().int().min(0),
    color: z.string().optional(),
    size: z.string().optional(),
    material: z.string().optional(),
  })).optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  materials: z.array(z.string()).optional(),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
});

export const CreateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().optional(),
    quantity: z.number().int().min(1),
  })).min(1),
  shippingAddress: z.object({
    fullName: z.string().min(1).max(200),
    street: z.string().min(1).max(300),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(1).max(100),
  }),
  couponCode: z.string().max(50).optional(),
  paymentMethod: z.string().max(100).optional(),
});

export const ValidateCouponSchema = z.object({
  code: z.string().min(1).max(50),
  subtotal: z.coerce.number().min(0),
});

export const StockAdjustSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantityDelta: z.number().int(),
  reason: z.string().min(1).max(500),
});

export const ReviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(200),
  comment: z.string().min(1).max(2000),
});
