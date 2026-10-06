import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, ProductVariant, CartItem, WishlistItem, Coupon, User, Role } from '../types';
import { push } from '../lib/routerBridge';
import { validateCoupon as apiValidateCoupon, logoutAccount } from '../lib/api';
import { calculateDiscount, calculateShipping, calculateTax } from '../lib/pricing';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface AppStore {
  // Navigation
  currentRoute: string;
  routeParams: Record<string, string>;
  navigate: (route: string, params?: Record<string, string>) => void;

  // Search & Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  priceRange: [number, number];
  setPriceRange: (range: [number, number]) => void;
  sortBy: 'newest' | 'price-asc' | 'price-desc' | 'popular' | 'rating';
  setSortBy: (sort: 'newest' | 'price-asc' | 'price-desc' | 'popular' | 'rating') => void;

  // Cart
  cart: CartItem[];
  appliedCoupon: Coupon | null;
  couponError: string | null;
  addToCart: (product: Product, quantity?: number, variant?: ProductVariant) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  getCartSubtotal: () => number;
  getCartDiscount: () => number;
  getCartShipping: () => number;
  getCartTax: () => number;
  getCartTotal: () => number;
  getCartItemCount: () => number;

  // Wishlist
  wishlist: WishlistItem[];
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;

  // Auth & Roles
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // Language & Localization
  language: 'ar' | 'en';
  setLanguage: (lang: 'ar' | 'en') => void;

  // Theme (dark default; persisted so reloads keep the choice)
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  // Quickview modal
  quickViewProduct: Product | null;
  setQuickViewProduct: (product: Product | null) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Localization
      language: 'ar',
      setLanguage: (lang) => {
        set({ language: lang });
        if (typeof document !== 'undefined') {
          document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = lang;
        }
      },

      // Theme
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.theme = theme;
        }
      },
      toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

      // Navigation — routes through react-router (see routerBridge.ts)
      currentRoute: 'home',
      routeParams: {},
      navigate: (route, params = {}) => {
        set({ currentRoute: route, routeParams: params });
        push(route, params);
      },

      // Search & Filters
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      selectedCategory: 'all',
      setSelectedCategory: (cat) => set({ selectedCategory: cat }),
      priceRange: [0, 8000],
      setPriceRange: (range) => set({ priceRange: range }),
      sortBy: 'newest',
      setSortBy: (sort) => set({ sortBy: sort }),

      // Cart
      cart: [],
      appliedCoupon: null,
      couponError: null,

      addToCart: (product, quantity = 1, variant) => {
        const cart = get().cart;
        const availableStock = variant ? variant.stock : product.stock;
        const existingIndex = cart.findIndex(
          (item) => item.productId === product.id && item.variantId === variant?.id
        );

        if (existingIndex > -1) {
          const currentQty = cart[existingIndex].quantity;
          if (currentQty + quantity > availableStock) {
            get().addToast({ type: 'error', title: 'Stock Limit Reached', message: `Only ${availableStock} units available for this selection.` });
            return;
          }
          const updatedCart = [...cart];
          updatedCart[existingIndex].quantity += quantity;
          set({ cart: updatedCart });
        } else {
          if (quantity > availableStock) {
            get().addToast({ type: 'error', title: 'Stock Limit Reached', message: `Only ${availableStock} units available for this selection.` });
            return;
          }
          const price = variant ? variant.price : product.price;
          const newItem: CartItem = {
            id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            productId: product.id, product, variantId: variant?.id, variant, quantity, price,
          };
          set({ cart: [newItem, ...cart] });
        }

        get().addToast({ type: 'success', title: 'Added to Bag', message: `${product.name} ${variant ? `(${variant.name})` : ''} added.` });
      },

      updateQuantity: (cartItemId, delta) => {
        const cart = get().cart;
        const item = cart.find((i) => i.id === cartItemId);
        if (!item) return;
        const maxStock = item.variant ? item.variant.stock : item.product.stock;
        const newQty = item.quantity + delta;
        if (newQty <= 0) { get().removeFromCart(cartItemId); return; }
        if (newQty > maxStock) {
          get().addToast({ type: 'error', title: 'Max Stock Exceeded', message: `Only ${maxStock} units currently available.` });
          return;
        }
        set({ cart: cart.map((i) => (i.id === cartItemId ? { ...i, quantity: newQty } : i)) });
      },

      removeFromCart: (cartItemId) => {
        const item = get().cart.find((i) => i.id === cartItemId);
        set({ cart: get().cart.filter((i) => i.id !== cartItemId) });
        if (item) get().addToast({ type: 'info', title: 'Item Removed', message: `${item.product.name} removed from your bag.` });
      },

      clearCart: () => set({ cart: [], appliedCoupon: null, couponError: null }),

      applyCoupon: async (code) => {
        const subtotal = get().getCartSubtotal();
        try {
          const result = await apiValidateCoupon(code, subtotal);
          if (result.valid && result.coupon) {
            const c = result.coupon;
            const coupon: Coupon = {
              id: c.id, code: c.code, type: c.type, value: c.value,
              startsAt: '', expiresAt: '', usageLimit: 0, usageCount: 0, isActive: true,
              description: '',
            };
            set({ appliedCoupon: coupon, couponError: null });
            get().addToast({ type: 'success', title: 'Coupon Applied', message: `${c.code}: ${typeof result.discount === 'number' ? `$${result.discount} off` : 'discount applied'}` });
            return true;
          }
          set({ couponError: result.error || 'Invalid code' });
          get().addToast({ type: 'error', title: 'Coupon Rejected', message: result.error });
          return false;
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unable to validate coupon';
          set({ couponError: msg });
          get().addToast({ type: 'error', title: 'Coupon Rejected', message: msg });
          return false;
        }
      },

      removeCoupon: () => {
        set({ appliedCoupon: null, couponError: null });
        get().addToast({ type: 'info', title: 'Coupon Removed', message: 'Promotional discount cleared.' });
      },

      getCartSubtotal: () => get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0),

      getCartDiscount: () => calculateDiscount(get().appliedCoupon, get().getCartSubtotal()),

      getCartShipping: () => {
        const subtotal = get().getCartSubtotal();
        const discount = get().getCartDiscount();
        return calculateShipping(subtotal - discount);
      },

      getCartTax: () => {
        const subtotal = get().getCartSubtotal();
        const discount = get().getCartDiscount();
        return calculateTax(subtotal - discount);
      },

      getCartTotal: () => {
        const subtotal = get().getCartSubtotal();
        const discount = get().getCartDiscount();
        const shipping = get().getCartShipping();
        const tax = get().getCartTax();
        return Math.max(0, Math.round((subtotal - discount + shipping + tax) * 100) / 100);
      },

      getCartItemCount: () => get().cart.reduce((sum, item) => sum + item.quantity, 0),

      // Wishlist
      wishlist: [],
      toggleWishlist: (product) => {
        const wishlist = get().wishlist;
        const exists = wishlist.some((w) => w.productId === product.id);
        const lang = get().language;
        let updatedWishlist: WishlistItem[];
        if (exists) {
          updatedWishlist = wishlist.filter((w) => w.productId !== product.id);
          get().addToast({ type: 'info', title: lang === 'ar' ? 'تم الحذف من المفضلة' : 'Removed from Wishlist', message: `${product.name} ${lang === 'ar' ? 'أُزيل من قائمة المقتنيات.' : 'removed from your wishlist.'}` });
        } else {
          updatedWishlist = [{ id: `wl_${Date.now()}`, productId: product.id, product, addedAt: new Date().toISOString() }, ...wishlist];
          get().addToast({ type: 'success', title: lang === 'ar' ? 'تم الحفظ في المفضلة' : 'Added to Wishlist', message: `${product.name} ${lang === 'ar' ? 'حُفظ في المفضلة.' : 'saved to your wishlist.'}` });
        }
        set({ wishlist: updatedWishlist });
      },

      isInWishlist: (productId) => get().wishlist.some((w) => w.productId === productId),

      // Auth
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),

      logout: async () => {
        await logoutAccount();
        set({ currentUser: null, appliedCoupon: null, couponError: null });
        get().addToast({
          type: 'info',
          title: get().language === 'ar' ? 'تسجيل الخروج' : 'Signed Out',
          message: get().language === 'ar' ? 'تم تسجيل الخروج بنجاح.' : 'You have been signed out.',
        });
      },

      // Toasts
      toasts: [],
      addToast: (toast) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
        setTimeout(() => get().removeToast(id), 4000);
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      // Quickview
      quickViewProduct: null,
      setQuickViewProduct: (product) => set({ quickViewProduct: product }),
    }),
    {
      name: 'nexora_client_store',
      partialize: (state) => ({
        cart: state.cart,
        wishlist: state.wishlist,
        appliedCoupon: state.appliedCoupon,
        currentUser: state.currentUser,
        theme: state.theme,
      }),
    }
  )
);
