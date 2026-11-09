export type Role = 'CUSTOMER' | 'MANAGER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string;
  avatar?: string;
  createdAt: string;
}

export interface Address {
  id: string;
  userId: string;
  fullName: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  itemCount: number;
}

export interface ProductVariantOption {
  color?: string;
  size?: string;
  material?: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  color?: string;
  size?: string;
  material?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  altText: string;
  isPrimary: boolean;
  order: number;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  sku: string;
  stock: number;
  categoryId: string;
  categoryName: string;
  images: ProductImage[];
  variants: ProductVariant[];
  rating: number;
  reviewsCount: number;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  isFeatured: boolean;
  isBestSeller: boolean;
  isTrending: boolean;
  materials?: string[];
  dimensions?: string;
  weight?: string;
  origin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  variantId?: string;
  variant?: ProductVariant;
  quantity: number;
  price: number;
}

export interface CartSummary {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  estimatedTax: number;
  total: number;
  appliedCoupon?: Coupon;
}

export interface WishlistItem {
  id: string;
  productId: string;
  product: Product;
  addedAt: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productImage: string;
  sku: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  stripePaymentIntentId?: string;
  shippingAddress: Address;
  trackingNumber?: string;
  shippingCarrier?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CouponType = 'PERCENTAGE' | 'FIXED';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  startsAt: string;
  expiresAt: string;
  usageLimit: number;
  usageCount: number;
  isActive: boolean;
  description: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  variantId?: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  stockAfter: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface AdminAnalytics {
  totalRevenue: number;
  revenueChangePercent: number;
  totalOrders: number;
  ordersChangePercent: number;
  totalCustomers: number;
  customersChangePercent: number;
  averageOrderValue: number;
  lowStockCount: number;
  revenueByDay: { date: string; amount: number }[];
  salesByCategory: { category: string; amount: number; percentage: number }[];
  recentOrders: Order[];
  topSellingProducts: { product: Product; unitsSold: number; revenue: number }[];
}

// ─── Phase 02: Projects, Certifications & Media Asset Contracts ───────────────

export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ProjectClientType = 'PRIVATE_COLLECTOR' | 'RESIDENTIAL' | 'COMMERCIAL' | 'INSTITUTIONAL';
export type CertificationVerificationStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'EXPIRED' | 'REVOKED';
export type MediaStorageProvider = 'local' | 's3' | 'gcs';
export type MediaVisibility = 'public' | 'private';

export type ProjectMediaRole =
  | 'COVER'
  | 'GALLERY'
  | 'DIAGRAM'
  | 'BEFORE_AFTER_BEFORE'
  | 'BEFORE_AFTER_AFTER'
  | 'BLUEPRINT'
  | 'INSTALLATION';

export type CertificationMediaRole =
  | 'BADGE'
  | 'CERTIFICATE_SCAN'
  | 'TEST_REPORT'
  | 'EVIDENCE_DOCUMENT'
  | 'AUDIT_REPORT';

export interface MediaAsset {
  id: string;
  originalFilename: string;
  storedFilename: string;
  storageProvider: MediaStorageProvider;
  storagePath: string;
  publicUrl: string | null;
  visibility: MediaVisibility;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  sha256: string;
  altText: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMedia {
  id: string;
  projectId: string;
  mediaAssetId: string;
  role: ProjectMediaRole;
  sortOrder: number;
  caption: string;
  createdAt: string;
  mediaAsset?: MediaAsset;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  discipline: string;
  clientType: ProjectClientType;
  clientName?: string | null;
  description: string;
  challenge: string;
  solution: string;
  materials: string[];
  location: string;
  completionDate?: string | null;
  coverMediaId: string | null;
  coverImageUrl: string;
  publicationStatus: PublicationStatus;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  media?: ProjectMedia[];
}

export interface CertificationMedia {
  id: string;
  certificationId: string;
  mediaAssetId: string;
  role: CertificationMediaRole;
  sortOrder: number;
  caption: string;
  createdAt: string;
  mediaAsset?: MediaAsset;
}

export interface Certification {
  id: string;
  slug: string;
  title: string;
  issuingOrganization: string;
  credentialId: string;
  credentialUrl?: string | null;
  issueDate: string;
  expirationDate?: string | null;
  applicableDisciplines: string[];
  skillsStandards: string;
  badgeMediaId: string | null;
  badgeImageUrl: string;
  publicationStatus: PublicationStatus;
  verificationStatus: CertificationVerificationStatus;
  verificationNotes: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  effectiveVerificationStatus?: CertificationVerificationStatus;
  evidence?: CertificationMedia[];
}

