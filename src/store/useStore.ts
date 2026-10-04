import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, ProductVariant, CartItem, WishlistItem, Coupon, User, Role } from '../types';
import { db } from '../lib/db';
import {
  syncWishlistToFirestore,
  ensureAuthenticatedUserId,
  loadWishlistFromFirestore,
} from '../lib/firebase';

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
  applyCoupon: (code: string) => boolean;
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
  loadFirestoreWishlist: (userId?: string) => Promise<void>;

  // Auth & Roles
  currentUser: User;
  switchRole: (role: Role) => void;
  logout: () => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // Language & Localization
  language: 'ar' | 'en';
  setLanguage: (lang: 'ar' | 'en') => void;

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

      // Navigation
      currentRoute: 'home',
      routeParams: {},
      navigate: (route, params = {}) => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        set({ currentRoute: route, routeParams: params });
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

        // Check if item already exists in bag
        const existingIndex = cart.findIndex(
          (item) => item.productId === product.id && item.variantId === variant?.id
        );

        if (existingIndex > -1) {
          const currentQty = cart[existingIndex].quantity;
          if (currentQty + quantity > availableStock) {
            get().addToast({
              type: 'error',
              title: 'Stock Limit Reached',
              message: `Only ${availableStock} units available for this selection.`,
            });
            return;
          }
          const updatedCart = [...cart];
          updatedCart[existingIndex].quantity += quantity;
          set({ cart: updatedCart });
        } else {
          if (quantity > availableStock) {
            get().addToast({
              type: 'error',
              title: 'Stock Limit Reached',
              message: `Only ${availableStock} units available for this selection.`,
            });
            return;
          }

          const price = variant ? variant.price : product.price;
          const newItem: CartItem = {
            id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            productId: product.id,
            product,
            variantId: variant?.id,
            variant,
            quantity,
            price,
          };
          set({ cart: [newItem, ...cart] });
        }

        get().addToast({
          type: 'success',
          title: 'Added to Bag',
          message: `${product.name} ${variant ? `(${variant.name})` : ''} added.`,
        });
      },

      updateQuantity: (cartItemId, delta) => {
        const cart = get().cart;
        const item = cart.find((i) => i.id === cartItemId);
        if (!item) return;

        const maxStock = item.variant ? item.variant.stock : item.product.stock;
        const newQty = item.quantity + delta;

        if (newQty <= 0) {
          get().removeFromCart(cartItemId);
          return;
        }

        if (newQty > maxStock) {
          get().addToast({
            type: 'error',
            title: 'Max Stock Exceeded',
            message: `Only ${maxStock} units currently available.`,
          });
          return;
        }

        const updated = cart.map((i) => (i.id === cartItemId ? { ...i, quantity: newQty } : i));
        set({ cart: updated });
      },

      removeFromCart: (cartItemId) => {
        const item = get().cart.find((i) => i.id === cartItemId);
        set({ cart: get().cart.filter((i) => i.id !== cartItemId) });
        if (item) {
          get().addToast({
            type: 'info',
            title: 'Item Removed',
            message: `${item.product.name} removed from your bag.`,
          });
        }
      },

      clearCart: () => set({ cart: [], appliedCoupon: null, couponError: null }),

      applyCoupon: (code) => {
        const subtotal = get().getCartSubtotal();
        const result = db.validateCoupon(code, subtotal);
        if (result.valid && result.coupon) {
          set({ appliedCoupon: result.coupon, couponError: null });
          get().addToast({
            type: 'success',
            title: 'Coupon Applied',
            message: `${result.coupon.code}: ${result.coupon.description}`,
          });
          return true;
        } else {
          set({ couponError: result.error || 'Invalid code' });
          get().addToast({
            type: 'error',
            title: 'Coupon Rejected',
            message: result.error,
          });
          return false;
        }
      },

      removeCoupon: () => {
        set({ appliedCoupon: null, couponError: null });
        get().addToast({
          type: 'info',
          title: 'Coupon Removed',
          message: 'Promotional discount cleared.',
        });
      },

      getCartSubtotal: () => {
        return get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },

      getCartDiscount: () => {
        const subtotal = get().getCartSubtotal();
        const coupon = get().appliedCoupon;
        if (!coupon) return 0;
        return db.calculateDiscount(coupon, subtotal);
      },

      getCartShipping: () => {
        const subtotal = get().getCartSubtotal();
        const discount = get().getCartDiscount();
        const net = subtotal - discount;
        if (net === 0) return 0;
        return net >= 200 ? 0 : 25;
      },

      getCartTax: () => {
        const subtotal = get().getCartSubtotal();
        const discount = get().getCartDiscount();
        const net = Math.max(0, subtotal - discount);
        return Math.round(net * 0.08 * 100) / 100;
      },

      getCartTotal: () => {
        const subtotal = get().getCartSubtotal();
        const discount = get().getCartDiscount();
        const shipping = get().getCartShipping();
        const tax = get().getCartTax();
        return Math.max(0, Math.round((subtotal - discount + shipping + tax) * 100) / 100);
      },

      getCartItemCount: () => {
        return get().cart.reduce((sum, item) => sum + item.quantity, 0);
      },

      // Wishlist
      wishlist: [],
      toggleWishlist: (product) => {
        const wishlist = get().wishlist;
        const exists = wishlist.some((w) => w.productId === product.id);
        const lang = get().language;

        let updatedWishlist: WishlistItem[];
        if (exists) {
          updatedWishlist = wishlist.filter((w) => w.productId !== product.id);
          set({ wishlist: updatedWishlist });
          get().addToast({
            type: 'info',
            title: lang === 'ar' ? 'تم الحذف من المفضلة' : 'Removed from Wishlist',
            message: `${product.name} ${lang === 'ar' ? 'أُزيل من قائمة المقتنيات.' : 'removed from your wishlist.'}`,
          });
        } else {
          const newItem: WishlistItem = {
            id: `wl_${Date.now()}`,
            productId: product.id,
            product,
            addedAt: new Date().toISOString(),
          };
          updatedWishlist = [newItem, ...wishlist];
          set({ wishlist: updatedWishlist });
          get().addToast({
            type: 'success',
            title: lang === 'ar' ? 'تم الحفظ في المفضلة' : 'Added to Wishlist',
            message: `${product.name} ${lang === 'ar' ? 'حُفظ في المفضلة وتم التزامن مع Firestore.' : 'saved to your wishlist and synced to Firestore.'}`,
          });
        }

        // Asynchronously save state to user's document in Firestore
        ensureAuthenticatedUserId()
          .then((uid) => {
            syncWishlistToFirestore(
              uid,
              updatedWishlist.map((w) => ({ productId: w.productId, addedAt: w.addedAt }))
            );
          })
          .catch((err) => {
            console.warn('Failed to sync wishlist to Firestore:', err);
          });
      },

      isInWishlist: (productId) => {
        return get().wishlist.some((w) => w.productId === productId);
      },

      loadFirestoreWishlist: async (userId?: string) => {
        try {
          const uid = userId || (await ensureAuthenticatedUserId());
          const productIds = await loadWishlistFromFirestore(uid);
          if (productIds && productIds.length > 0) {
            const allProducts = db.getProducts({ sortBy: 'newest' });
            const restoredItems: WishlistItem[] = productIds
              .map((pid) => {
                const prod = allProducts.find((p) => p.id === pid);
                if (!prod) return null;
                return {
                  id: `wl_fs_${pid}`,
                  productId: pid,
                  product: prod,
                  addedAt: new Date().toISOString(),
                };
              })
              .filter(Boolean) as WishlistItem[];

            if (restoredItems.length > 0) {
              set({ wishlist: restoredItems });
            }
          }
        } catch (err) {
          console.warn('Failed to load wishlist from Firestore:', err);
        }
      },

      // Auth & Roles
      currentUser: db.getCurrentUser(),
      switchRole: (role) => {
        const user = db.switchRole(role);
        set({ currentUser: user });
        get().addToast({
          type: 'info',
          title: `Role Switched: ${role}`,
          message: `Now operating with ${role.toLowerCase()} privileges as ${user.name}.`,
        });
      },

      logout: () => {
        // Reset to customer
        const cust = db.switchRole('CUSTOMER');
        set({ currentUser: cust });
        get().addToast({
          type: 'info',
          title: 'Signed Out',
          message: 'Returned to standard customer browsing session.',
        });
      },

      // Toasts
      toasts: [],
      addToast: (toast) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const newToast: ToastMessage = { ...toast, id };
        set((state) => ({ toasts: [...state.toasts, newToast] }));

        setTimeout(() => {
          get().removeToast(id);
        }, 4000);
      },
      removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      },

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
      }),
    }
  )
);
