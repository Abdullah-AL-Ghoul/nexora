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
