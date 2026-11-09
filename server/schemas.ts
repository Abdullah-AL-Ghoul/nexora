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

// ─── Phase 02: Projects, Certifications & Media Zod Schemas ───────────────────

export const PublicationStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const ProjectClientTypeSchema = z.enum(['PRIVATE_COLLECTOR', 'RESIDENTIAL', 'COMMERCIAL', 'INSTITUTIONAL']);
export const CertificationVerificationStatusSchema = z.enum(['PENDING_VERIFICATION', 'VERIFIED', 'EXPIRED', 'REVOKED']);
export const MediaStorageProviderSchema = z.enum(['local', 's3', 'gcs']);
export const MediaVisibilitySchema = z.enum(['public', 'private']);
export const ProjectMediaRoleSchema = z.enum([
  'COVER',
  'GALLERY',
  'DIAGRAM',
  'BEFORE_AFTER_BEFORE',
  'BEFORE_AFTER_AFTER',
  'BLUEPRINT',
  'INSTALLATION',
]);
export const CertificationMediaRoleSchema = z.enum([
  'BADGE',
  'CERTIFICATE_SCAN',
  'TEST_REPORT',
  'EVIDENCE_DOCUMENT',
  'AUDIT_REPORT',
]);

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)?$/;

export const CreateProjectSchema = z.object({
  slug: z.string().min(2).max(120).regex(slugRegex, 'Slug must contain only lowercase letters, numbers, and single hyphens'),
  title: z.string().min(2).max(200),
  subtitle: z.string().max(300).optional().default(''),
  discipline: z.string().min(2).max(100),
  clientType: ProjectClientTypeSchema.default('PRIVATE_COLLECTOR'),
  clientName: z.string().max(200).nullable().optional(),
  description: z.string().max(10000).optional().default(''),
  challenge: z.string().max(5000).optional().default(''),
  solution: z.string().max(5000).optional().default(''),
  materials: z.array(z.string().min(1).max(100)).max(50).optional().default([]),
  location: z.string().max(200).optional().default(''),
  completionDate: z.string().regex(isoDateRegex, 'Must be a valid ISO date').nullable().optional(),
  coverMediaId: z.string().min(1).nullable().optional(),
  coverImageUrl: z.string().max(1000).optional().default(''),
  publicationStatus: PublicationStatusSchema.default('DRAFT'),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export const CreateCertificationSchema = z.object({
  slug: z.string().min(2).max(120).regex(slugRegex, 'Slug must contain only lowercase letters, numbers, and single hyphens'),
  title: z.string().min(2).max(200),
  issuingOrganization: z.string().min(2).max(200),
  credentialId: z.string().max(100).optional().default(''),
  credentialUrl: z.string().url().max(1000).nullable().optional(),
  issueDate: z.string().regex(isoDateRegex, 'Must be a valid ISO date'),
  expirationDate: z.string().regex(isoDateRegex, 'Must be a valid ISO date').nullable().optional(),
  applicableDisciplines: z.array(z.string().min(1).max(100)).max(20).optional().default([]),
  skillsStandards: z.string().max(2000).optional().default(''),
  badgeMediaId: z.string().min(1).nullable().optional(),
  badgeImageUrl: z.string().max(1000).optional().default(''),
  publicationStatus: PublicationStatusSchema.default('DRAFT'),
  // Client create/update cannot assert official verification; DRAFT belongs exclusively to publicationStatus
  verificationStatus: z.literal('PENDING_VERIFICATION').default('PENDING_VERIFICATION'),
  verificationNotes: z.string().max(2000).optional().default(''),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateCertificationSchema = CreateCertificationSchema.partial().extend({
  // Client cannot self-verify or set invalid status; only PENDING_VERIFICATION is acceptable if passed
  verificationStatus: z.literal('PENDING_VERIFICATION').optional(),
});

/**
 * Dedicated schema for administrative verification actions.
 * Only authenticated administrators can execute this operation.
 * Expiration is dynamically derived from expirationDate, so EXPIRED cannot be forced via input.
 */
export const AdminVerifyCertificationSchema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'REVOKED', 'PENDING_VERIFICATION']),
  verificationNotes: z.string().min(3).max(2000),
  verifiedAt: z.string().regex(isoDateRegex).optional(),
});

export const CreateMediaAssetSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  storedFilename: z.string().min(1).max(255),
  storageProvider: MediaStorageProviderSchema.default('local'),
  storagePath: z.string().min(1).max(1000),
  publicUrl: z.string().max(1000).nullable(),
  visibility: MediaVisibilitySchema.default('public'),
  mimeType: z.string().min(3).max(100),
  fileSize: z.number().int().positive(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  sha256: z.string().length(64),
  altText: z.string().max(500).optional().default(''),
  uploadedBy: z.string().min(1),
}).refine(
  (data) => {
    if (data.visibility === 'public') {
      return data.publicUrl !== null && data.publicUrl.trim().length > 0;
    }
    return data.publicUrl === null;
  },
  {
    message: 'Public assets must have a non-empty publicUrl; private assets must have publicUrl = null',
    path: ['publicUrl'],
  }
);

export const UpdateMediaAssetSchema = z.object({
  altText: z.string().max(500).optional(),
  visibility: MediaVisibilitySchema.optional(),
  publicUrl: z.string().max(1000).nullable().optional(),
}).refine(
  (data) => {
    if (data.visibility !== undefined && data.publicUrl !== undefined) {
      if (data.visibility === 'public') {
        return data.publicUrl !== null && data.publicUrl.trim().length > 0;
      }
      if (data.visibility === 'private') {
        return data.publicUrl === null;
      }
    }
    return true;
  },
  {
    message: 'Public assets must have a non-empty publicUrl; private assets must have publicUrl = null',
    path: ['publicUrl'],
  }
);

/**
 * Validates that merging a partial update into an existing media asset produces a valid visibility/publicUrl state.
 */
export function validateMergedMediaAsset(
  current: { visibility: 'public' | 'private'; publicUrl: string | null },
  patch: { visibility?: 'public' | 'private'; publicUrl?: string | null }
): void {
  const mergedVisibility = patch.visibility ?? current.visibility;
  const mergedPublicUrl = patch.publicUrl !== undefined ? patch.publicUrl : current.publicUrl;

  if (mergedVisibility === 'public' && (!mergedPublicUrl || mergedPublicUrl.trim().length === 0)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: 'Public assets must have a non-empty publicUrl',
        path: ['publicUrl'],
      },
    ]);
  }
  if (mergedVisibility === 'private' && mergedPublicUrl !== null) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: 'Private assets must have publicUrl = null',
        path: ['publicUrl'],
      },
    ]);
  }
}

