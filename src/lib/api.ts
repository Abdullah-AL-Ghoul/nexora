// ─────────────────────────────────────────────────────────────────────────────
// NEXORA API client — single source of truth for server communication.
// Every request attaches the current session token via Authorization header.
// Tokens: local JWT sessions (primary) or Firebase ID token (secondary).
// Firebase Auth is imported lazily so the ~180KB SDK only loads when needed.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'nexora_auth_token';

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
}

const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function getToken(): Promise<string> {
  // 1) Local JWT session (primary)
  const local = getStoredToken();
  if (local) return local;
  // 2) Firebase ID token (secondary — only if a user is actually signed in)
  try {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    if (auth.currentUser) {
      const t = await auth.currentUser.getIdToken();
      if (t) return t;
    }
  } catch { /* ignore */ }
  // 3) Guest — no token; server treats as unauthenticated
  return '';
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface AuthSession {
  token: string;
  user: {
    id: string; email: string; name: string; role: string;
    phone?: string | null; avatar?: string | null; createdAt?: string;
  };
}

export async function registerAccount(name: string, email: string, password: string): Promise<AuthSession> {
  const session = await api.post<AuthSession>('/auth/register', { name, email, password });
  setStoredToken(session.token);
  return session;
}

export async function loginAccount(email: string, password: string): Promise<AuthSession> {
  const session = await api.post<AuthSession>('/auth/login', { email, password });
  setStoredToken(session.token);
  return session;
}

export async function logoutAccount(): Promise<void> {
  try { await api.post('/auth/logout'); } catch { /* server best-effort */ }
  setStoredToken(null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed domain helpers below mirror the old db.ts surface (now async).
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiProduct {
  id: string; name: string; slug: string; tagline: string; description: string;
  price: number; compareAtPrice?: number | null; sku: string; stock: number;
  categoryId: string; categoryName: string;
  images: { id: string; url: string; altText: string; isPrimary: boolean; order: number }[];
  variants: { id: string; productId?: string; name: string; sku: string; price: number; stock: number; color?: string; size?: string; material?: string }[];
  rating: number; reviewsCount: number; status: string;
  isFeatured: boolean; isBestSeller: boolean; isTrending: boolean;
  materials?: string[]; dimensions?: string; weight?: string; origin?: string;
  createdAt: string; updatedAt: string;
}

export interface FetchProductsParams {
  categorySlug?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'newest' | 'price-asc' | 'price-desc' | 'popular' | 'rating';
  inStockOnly?: boolean;
  featuredOnly?: boolean;
  limit?: number;
  page?: number;
}

export async function fetchProducts(params: FetchProductsParams = {}): Promise<ApiProduct[]> {
  const qs = new URLSearchParams();
  if (params.categorySlug && params.categorySlug !== 'all') qs.set('categorySlug', params.categorySlug);
  if (params.search) qs.set('search', params.search);
  if (params.minPrice != null) qs.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) qs.set('maxPrice', String(params.maxPrice));
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await api.get<{ products: ApiProduct[] }>(`/products${suffix}`);
  return data.products;
}

export const fetchProductBySlug = (slug: string) =>
  api.get<{ product: ApiProduct }>(`/products/${slug}`).then((d) => d.product);

export const fetchFeaturedProducts = () =>
  api.get<{ products: ApiProduct[] }>('/products/featured').then((d) => d.products);

export const fetchRelatedProducts = (slug: string) =>
  api.get<{ products: ApiProduct[] }>(`/products/related/${slug}`).then((d) => d.products);

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  createdAt: string;
}

export const fetchReviews = (slug: string) =>
  api.get<{ reviews: Review[] }>(`/products/${slug}/reviews`).then((d) => d.reviews);

export const submitReview = (slug: string, payload: { rating: number; title: string; comment: string; userName?: string }) =>
  api.post<{ review: Review }>(`/products/${slug}/reviews`, payload).then((d) => d.review);

export interface ApiCategory {
  id: string; name: string; slug: string; description: string; image_url: string; item_count: number;
}

export const fetchCategories = () =>
  api.get<{ categories: ApiCategory[] }>('/categories').then((d) => d.categories);

export const fetchCurrentUser = () =>
  api.get<{ user: { id: string; email: string; name: string; role: string; avatar?: string | null; phone?: string | null; created_at?: string } }>('/users/me')
    .then((d) => d.user);

export const fetchUsers = () =>
  api.get<{ users: Array<{ id: string; email: string; name: string; role: string; avatar?: string | null; phone?: string | null; created_at?: string }> }>('/users')
    .then((d) => d.users);

export interface ValidateCouponResult {
  valid: boolean;
  error?: string;
  discount?: number;
  coupon?: { id: string; code: string; type: 'PERCENTAGE' | 'FIXED'; value: number };
}

export async function validateCoupon(code: string, subtotal: number): Promise<ValidateCouponResult> {
  const qs = new URLSearchParams({ code, subtotal: String(subtotal) });
  return api.get<ValidateCouponResult>(`/coupons/validate?${qs.toString()}`);
}

export interface CreateOrderInput {
  items: { productId: string; variantId?: string; quantity: number }[];
  shippingAddress: {
    fullName: string; street: string; city: string; state: string; postalCode: string; country: string;
  };
  couponCode?: string;
  paymentMethod?: string;
}

export const createOrder = (input: CreateOrderInput) =>
  api.post<{ success: boolean; order: any }>('/orders', input).then((d) => d.order);

export const fetchOrders = () =>
  api.get<{ orders: any[] }>('/orders').then((d) => d.orders);

export const fetchOrderById = (id: string) =>
  api.get<{ order: any }>(`/orders/${id}`).then((d) => d.order);

export const fetchAnalytics = () =>
  api.get<Record<string, any>>('/users/analytics');

export const fetchAllProducts = () =>
  api.get<{ products: ApiProduct[] }>(`/products?limit=100`).then((d) => d.products);

// Admin write operations (server-enforced ADMIN/MANAGER)
export const saveProduct = (payload: any) => api.post<{ product: any }>('/products', payload).then((d) => d.product);
export const updateProduct = (id: string, payload: any) => api.put<{ product: any }>(`/products/${id}`, payload).then((d) => d.product);
export const deleteProduct = (id: string) => api.delete(`/products/${id}`);
export const saveCategory = (payload: any) => api.post<{ category: any }>('/categories', payload).then((d) => d.category);
export const deleteCategory = (id: string) => api.delete(`/categories/${id}`);
export const updateOrderStatus = (id: string, status: string) =>
  api.patch(`/orders/${id}/status`, { status });
export const deleteOrder = (id: string) => api.delete(`/orders/${id}`);
export const adjustStock = (productId: string, quantityDelta: number, reason: string) =>
  api.post('/inventory/adjust', { productId, quantityDelta, reason });
export const fetchInventoryTransactions = () =>
  api.get<{ transactions: any[] }>('/inventory/transactions').then((d) => d.transactions);

/** Minimal error state helper for pages. */
export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}
