import {
  Product,
  Category,
  User,
  Order,
  Coupon,
  Review,
  InventoryTransaction,
  AdminAnalytics,
  Role,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_USERS,
  INITIAL_COUPONS,
  INITIAL_ORDERS,
  INITIAL_REVIEWS,
  INITIAL_INVENTORY_TRANSACTIONS,
} from '../data/seedData';

const STORAGE_KEYS = {
  PRODUCTS: 'nexora_db_products',
  CATEGORIES: 'nexora_db_categories',
  USERS: 'nexora_db_users',
  ORDERS: 'nexora_db_orders',
  COUPONS: 'nexora_db_coupons',
  REVIEWS: 'nexora_db_reviews',
  INVENTORY_TX: 'nexora_db_inventory_tx',
  CURRENT_USER: 'nexora_auth_current_user',
};

class Database {
  private products: Product[] = [];
  private categories: Category[] = [];
  private users: User[] = [];
  private orders: Order[] = [];
  private coupons: Coupon[] = [];
  private reviews: Review[] = [];
  private inventoryTransactions: InventoryTransaction[] = [];
  private currentUser: User | null = null;
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') {
      this.products = [...INITIAL_PRODUCTS];
      this.categories = [...INITIAL_CATEGORIES];
      this.users = [...INITIAL_USERS];
      this.orders = [...INITIAL_ORDERS];
      this.coupons = [...INITIAL_COUPONS];
      this.reviews = [...INITIAL_REVIEWS];
      this.inventoryTransactions = [...INITIAL_INVENTORY_TRANSACTIONS];
      this.currentUser = INITIAL_USERS[2]; // Default to customer
      this.initialized = true;
      return;
    }

    try {
      const storedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      this.products = storedProducts ? JSON.parse(storedProducts) : [...INITIAL_PRODUCTS];

      const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      this.categories = storedCategories ? JSON.parse(storedCategories) : [...INITIAL_CATEGORIES];

      const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      this.users = storedUsers ? JSON.parse(storedUsers) : [...INITIAL_USERS];

      const storedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      this.orders = storedOrders ? JSON.parse(storedOrders) : [...INITIAL_ORDERS];

      const storedCoupons = localStorage.getItem(STORAGE_KEYS.COUPONS);
      this.coupons = storedCoupons ? JSON.parse(storedCoupons) : [...INITIAL_COUPONS];

      const storedReviews = localStorage.getItem(STORAGE_KEYS.REVIEWS);
      this.reviews = []; // Cleared all comments/reviews from website as requested
      if (storedReviews) {
        localStorage.removeItem(STORAGE_KEYS.REVIEWS);
      }

      const storedTx = localStorage.getItem(STORAGE_KEYS.INVENTORY_TX);
      this.inventoryTransactions = storedTx ? JSON.parse(storedTx) : [...INITIAL_INVENTORY_TRANSACTIONS];

      const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      this.currentUser = storedUser ? JSON.parse(storedUser) : this.users[2]; // Alexander Hayes (Customer)
    } catch {
      this.products = [...INITIAL_PRODUCTS];
      this.categories = [...INITIAL_CATEGORIES];
      this.users = [...INITIAL_USERS];
      this.orders = [...INITIAL_ORDERS];
      this.coupons = [...INITIAL_COUPONS];
      this.reviews = [...INITIAL_REVIEWS];
      this.inventoryTransactions = [...INITIAL_INVENTORY_TRANSACTIONS];
      this.currentUser = INITIAL_USERS[2];
    }
    this.initialized = true;
  }

  private persist(key: string, data: unknown) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (err) {
        console.error('Storage persistence failed', err);
      }
    }
  }

  // --- Reset to Demo State ---
  public resetToDemoState() {
    this.products = [...INITIAL_PRODUCTS];
    this.categories = [...INITIAL_CATEGORIES];
    this.users = [...INITIAL_USERS];
    this.orders = [...INITIAL_ORDERS];
    this.coupons = [...INITIAL_COUPONS];
    this.reviews = [...INITIAL_REVIEWS];
    this.inventoryTransactions = [...INITIAL_INVENTORY_TRANSACTIONS];
    this.currentUser = this.users[2];

    this.persist(STORAGE_KEYS.PRODUCTS, this.products);
    this.persist(STORAGE_KEYS.CATEGORIES, this.categories);
    this.persist(STORAGE_KEYS.USERS, this.users);
    this.persist(STORAGE_KEYS.ORDERS, this.orders);
    this.persist(STORAGE_KEYS.COUPONS, this.coupons);
    this.persist(STORAGE_KEYS.REVIEWS, this.reviews);
    this.persist(STORAGE_KEYS.INVENTORY_TX, this.inventoryTransactions);
    this.persist(STORAGE_KEYS.CURRENT_USER, this.currentUser);
  }

  // --- Products ---
  public getProducts(params?: {
    categorySlug?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: 'newest' | 'price-asc' | 'price-desc' | 'popular' | 'rating';
    inStockOnly?: boolean;
    featuredOnly?: boolean;
  }): Product[] {
    let result = [...this.products].filter((p) => p.status === 'ACTIVE');

    if (params?.categorySlug && params.categorySlug !== 'all') {
      const cat = this.categories.find((c) => c.slug === params.categorySlug);
      if (cat) {
        result = result.filter((p) => p.categoryId === cat.id);
      }
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.materials?.some((m) => m.toLowerCase().includes(q))
      );
    }

    if (params?.minPrice !== undefined) {
      result = result.filter((p) => p.price >= params.minPrice!);
    }

    if (params?.maxPrice !== undefined) {
      result = result.filter((p) => p.price <= params.maxPrice!);
    }

    if (params?.inStockOnly) {
      result = result.filter((p) => p.stock > 0);
    }

    if (params?.featuredOnly) {
      result = result.filter((p) => p.isFeatured);
    }

    // Sorting
    switch (params?.sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'popular':
        result.sort((a, b) => b.reviewsCount - a.reviewsCount);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return result;
  }

  public getProductBySlug(slug: string): Product | undefined {
    return this.products.find((p) => p.slug === slug);
  }

  public getProductById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  public getRelatedProducts(product: Product, limit = 4): Product[] {
    return this.products
      .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
      .slice(0, limit);
  }

  // Admin Product Operations
  public saveProduct(productData: Partial<Product> & { name: string; price: number; categoryId: string }): Product {
    const category = this.categories.find((c) => c.id === productData.categoryId);
    const categoryName = category ? category.name : 'Fine Accessories';

    if (productData.id) {
      const index = this.products.findIndex((p) => p.id === productData.id);
      if (index !== -1) {
        const updated: Product = {
          ...this.products[index],
          ...productData,
          categoryName,
          updatedAt: new Date().toISOString(),
        };
        this.products[index] = updated;
        this.persist(STORAGE_KEYS.PRODUCTS, this.products);
        return updated;
      }
    }

    const newProduct: Product = {
      id: `prod_${Date.now()}`,
      name: productData.name,
      slug: productData.slug || productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      tagline: productData.tagline || '',
      description: productData.description || '',
      price: productData.price,
      compareAtPrice: productData.compareAtPrice,
      sku: productData.sku || `NX-${Date.now().toString().slice(-4)}`,
      stock: productData.stock || 10,
      categoryId: productData.categoryId,
      categoryName,
      images: productData.images || [
        {
          id: `img_${Date.now()}`,
          url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80',
          altText: productData.name,
          isPrimary: true,
          order: 0,
        },
      ],
      variants: productData.variants || [],
      rating: 5.0,
      reviewsCount: 0,
      status: productData.status || 'ACTIVE',
      isFeatured: !!productData.isFeatured,
      isBestSeller: !!productData.isBestSeller,
      isTrending: !!productData.isTrending,
      materials: productData.materials || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.products.unshift(newProduct);
    this.persist(STORAGE_KEYS.PRODUCTS, this.products);
    return newProduct;
  }

  public deleteProduct(id: string): boolean {
    const initialLen = this.products.length;
    this.products = this.products.filter((p) => p.id !== id);
    if (this.products.length !== initialLen) {
      this.persist(STORAGE_KEYS.PRODUCTS, this.products);
      return true;
    }
    return false;
  }

  // --- Categories ---
  public getCategories(): Category[] {
    return [...this.categories];
  }

  public getCategoryBySlug(slug: string): Category | undefined {
    return this.categories.find((c) => c.slug === slug);
  }

  // --- Auth & Users ---
  public getCurrentUser(): User {
    return this.currentUser || this.users[2];
  }

  public setCurrentUser(user: User) {
    this.currentUser = user;
    this.persist(STORAGE_KEYS.CURRENT_USER, user);
  }

  public switchRole(role: Role): User {
    const targetUser = this.users.find((u) => u.role === role);
    if (targetUser) {
      this.currentUser = targetUser;
      this.persist(STORAGE_KEYS.CURRENT_USER, targetUser);
      return targetUser;
    }
    return this.getCurrentUser();
  }

  public getAllUsers(): User[] {
    return [...this.users];
  }

  public registerUser(name: string, email: string, role: Role = 'CUSTOMER'): User {
    const existing = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      this.currentUser = existing;
      this.persist(STORAGE_KEYS.CURRENT_USER, existing);
      return existing;
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      name,
      email,
      role,
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80`,
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);
    this.currentUser = newUser;
    this.persist(STORAGE_KEYS.USERS, this.users);
    this.persist(STORAGE_KEYS.CURRENT_USER, newUser);
    return newUser;
  }

  // --- Coupons ---
  public validateCoupon(code: string, subtotal: number): { valid: boolean; coupon?: Coupon; error?: string } {
    const cleanCode = code.trim().toUpperCase();
    const coupon = this.coupons.find((c) => c.code.toUpperCase() === cleanCode);

    if (!coupon) {
      return { valid: false, error: 'Invalid coupon code.' };
    }

    if (!coupon.isActive) {
      return { valid: false, error: 'This coupon is no longer active.' };
    }

    if (new Date() > new Date(coupon.expiresAt)) {
      return { valid: false, error: 'This coupon has expired.' };
    }

    if (coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, error: 'This coupon has reached its maximum redemptions.' };
    }

    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      return {
        valid: false,
        error: `Requires a minimum order of $${coupon.minOrderAmount}. (Current: $${subtotal.toFixed(2)})`,
      };
    }

    return { valid: true, coupon };
  }

  public calculateDiscount(coupon: Coupon, subtotal: number): number {
    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = (subtotal * coupon.value) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = Math.min(coupon.value, subtotal);
    }
    return Math.round(discount * 100) / 100;
  }

  // --- Orders & Atomic Checkout ---
  public createOrder(orderData: {
    items: { productId: string; variantId?: string; quantity: number }[];
    shippingAddress: {
      fullName: string;
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    couponCode?: string;
    paymentMethod: string;
  }): { success: boolean; order?: Order; error?: string } {
    // 1. Authoritative verification of products and inventory
    const resolvedItems: Order['items'] = [];
    let subtotal = 0;

    for (const item of orderData.items) {
      const product = this.getProductById(item.productId);
      if (!product) {
        return { success: false, error: `Product not found: ${item.productId}` };
      }

      let unitPrice = product.price;
      let sku = product.sku;
      let variantName: string | undefined = undefined;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          return { success: false, error: `Variant not found: ${item.variantId}` };
        }
        if (variant.stock < item.quantity) {
          return {
            success: false,
            error: `Insufficient stock for ${product.name} (${variant.name}). Available: ${variant.stock}`,
          };
        }
        unitPrice = variant.price;
        sku = variant.sku;
        variantName = variant.name;
      } else {
        if (product.stock < item.quantity) {
          return {
            success: false,
            error: `Insufficient stock for ${product.name}. Available: ${product.stock}`,
          };
        }
      }

      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;

      resolvedItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId: '', // Will be set after order ID is generated
        productId: product.id,
        productName: product.name,
        productImage: product.images[0]?.url || '',
        sku,
        variantName,
        unitPrice,
        quantity: item.quantity,
        totalPrice: itemTotal,
      });
    }

    // 2. Authoritative coupon evaluation
    let discount = 0;
    if (orderData.couponCode) {
      const couponValidation = this.validateCoupon(orderData.couponCode, subtotal);
      if (couponValidation.valid && couponValidation.coupon) {
        discount = this.calculateDiscount(couponValidation.coupon, subtotal);
        // Increment coupon usage
        couponValidation.coupon.usageCount += 1;
        this.persist(STORAGE_KEYS.COUPONS, this.coupons);
      }
    }

    // 3. Shipping calculation (Free over $200, else $25 flat luxury insured)
    const afterDiscount = subtotal - discount;
    const shipping = afterDiscount >= 200 ? 0 : 25;
    const tax = Math.round(afterDiscount * 0.08 * 100) / 100;
    const total = Math.round((afterDiscount + shipping + tax) * 100) / 100;

    // 4. Generate Order ID
    const orderNumber = `NX-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderId = `ord_${Date.now()}`;

    // Link items to order
    resolvedItems.forEach((i) => (i.orderId = orderId));

    const currentUser = this.getCurrentUser();
    const newOrder: Order = {
      id: orderId,
      orderNumber,
      userId: currentUser.id,
      customerName: orderData.shippingAddress.fullName || currentUser.name,
      customerEmail: currentUser.email,
      items: resolvedItems,
      subtotal,
      discount,
      shipping,
      tax,
      total,
      status: 'PAID',
      paymentStatus: 'SUCCEEDED',
      paymentMethod: orderData.paymentMethod || 'Stripe Test Card (•••• 4242)',
      stripePaymentIntentId: `pi_test_${Date.now().toString(36)}`,
      shippingAddress: {
        id: `addr_${Date.now()}`,
        userId: currentUser.id,
        fullName: orderData.shippingAddress.fullName,
        street: orderData.shippingAddress.street,
        city: orderData.shippingAddress.city,
        state: orderData.shippingAddress.state,
        postalCode: orderData.shippingAddress.postalCode,
        country: orderData.shippingAddress.country,
        isDefault: true,
      },
      trackingNumber: `NX-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      shippingCarrier: 'FedEx Luxury Air',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 5. Atomic Stock Decrement & Inventory Transaction Log
    for (const item of orderData.items) {
      const product = this.getProductById(item.productId)!;
      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId)!;
        variant.stock -= item.quantity;
      }
      product.stock -= item.quantity;

      this.inventoryTransactions.unshift({
        id: `inv_tx_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        variantId: item.variantId,
        type: 'OUT',
        quantity: item.quantity,
        stockAfter: product.stock,
        reason: `Order ${orderNumber} automated fulfillment`,
        performedBy: 'Stripe Webhook (System)',
        createdAt: new Date().toISOString(),
      });
    }

    this.orders.unshift(newOrder);
    this.persist(STORAGE_KEYS.PRODUCTS, this.products);
    this.persist(STORAGE_KEYS.ORDERS, this.orders);
    this.persist(STORAGE_KEYS.INVENTORY_TX, this.inventoryTransactions);

    return { success: true, order: newOrder };
  }

  public getOrders(userId?: string): Order[] {
    if (userId) {
      return this.orders.filter((o) => o.userId === userId);
    }
    return [...this.orders];
  }

  public getOrderById(id: string): Order | undefined {
    return this.orders.find((o) => o.id === id || o.orderNumber === id);
  }

  public updateOrderStatus(orderId: string, status: Order['status']): boolean {
    const order = this.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
      this.persist(STORAGE_KEYS.ORDERS, this.orders);
      return true;
    }
    return false;
  }

  public deleteOrder(orderId: string): boolean {
    const prevLen = this.orders.length;
    this.orders = this.orders.filter((o) => o.id !== orderId);
    if (this.orders.length !== prevLen) {
      this.persist(STORAGE_KEYS.ORDERS, this.orders);
      return true;
    }
    return false;
  }

  // --- Categories CRUD ---
  public saveCategory(categoryData: Partial<Category> & { name: string; slug: string }): Category {
    if (categoryData.id) {
      const idx = this.categories.findIndex((c) => c.id === categoryData.id);
      if (idx !== -1) {
        const updated = { ...this.categories[idx], ...categoryData };
        this.categories[idx] = updated;
        this.persist(STORAGE_KEYS.CATEGORIES, this.categories);
        return updated;
      }
    }
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      name: categoryData.name,
      slug: categoryData.slug,
      description: categoryData.description || 'Masterwork atelier and artisanal workshop.',
      imageUrl:
        categoryData.imageUrl ||
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      itemCount: 0,
    };
    this.categories.push(newCat);
    this.persist(STORAGE_KEYS.CATEGORIES, this.categories);
    return newCat;
  }

  public deleteCategory(id: string): boolean {
    const prevLen = this.categories.length;
    this.categories = this.categories.filter((c) => c.id !== id);
    if (this.categories.length !== prevLen) {
      this.persist(STORAGE_KEYS.CATEGORIES, this.categories);
      return true;
    }
    return false;
  }

  // --- Reviews ---
  public getReviewsForProduct(productId: string): Review[] {
    return this.reviews.filter((r) => r.productId === productId && r.isApproved);
  }

  public deleteReview(id: string): boolean {
    const prevLen = this.reviews.length;
    this.reviews = this.reviews.filter((r) => r.id !== id);
    if (this.reviews.length !== prevLen) {
      this.persist(STORAGE_KEYS.REVIEWS, this.reviews);
      return true;
    }
    return false;
  }

  public clearAllReviews(): void {
    this.reviews = [];
    this.persist(STORAGE_KEYS.REVIEWS, this.reviews);
    // Reset product reviews count
    this.products.forEach((p) => {
      p.reviewsCount = 0;
      p.rating = 5.0;
    });
    this.persist(STORAGE_KEYS.PRODUCTS, this.products);
  }

  public addReview(reviewData: { productId: string; rating: number; title: string; comment: string }): Review {
    const currentUser = this.getCurrentUser();
    const newReview: Review = {
      id: `rev_${Date.now()}`,
      productId: reviewData.productId,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      rating: reviewData.rating,
      title: reviewData.title,
      comment: reviewData.comment,
      isVerifiedPurchase: true,
      isApproved: true, // Auto-approve for demo realism
      createdAt: new Date().toISOString(),
    };

    this.reviews.unshift(newReview);
    this.persist(STORAGE_KEYS.REVIEWS, this.reviews);

    // Update product rating and review count
    const product = this.getProductById(reviewData.productId);
    if (product) {
      const allProductReviews = this.reviews.filter((r) => r.productId === product.id && r.isApproved);
      const avg = allProductReviews.reduce((sum, r) => sum + r.rating, 0) / allProductReviews.length;
      product.rating = Math.round(avg * 10) / 10;
      product.reviewsCount = allProductReviews.length;
      this.persist(STORAGE_KEYS.PRODUCTS, this.products);
    }

    return newReview;
  }

  public getAllReviews(): Review[] {
    return [...this.reviews];
  }

  public toggleReviewModeration(id: string, isApproved: boolean): boolean {
    const review = this.reviews.find((r) => r.id === id);
    if (review) {
      review.isApproved = isApproved;
      this.persist(STORAGE_KEYS.REVIEWS, this.reviews);
      return true;
    }
    return false;
  }

  // --- Inventory Transactions ---
  public getInventoryTransactions(): InventoryTransaction[] {
    return [...this.inventoryTransactions];
  }

  public adjustStock(productId: string, quantityDelta: number, reason: string): boolean {
    const product = this.getProductById(productId);
    if (!product) return false;

    product.stock = Math.max(0, product.stock + quantityDelta);

    this.inventoryTransactions.unshift({
      id: `inv_tx_${Date.now()}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: quantityDelta >= 0 ? 'IN' : 'OUT',
      quantity: Math.abs(quantityDelta),
      stockAfter: product.stock,
      reason,
      performedBy: this.getCurrentUser().name,
      createdAt: new Date().toISOString(),
    });

    this.persist(STORAGE_KEYS.PRODUCTS, this.products);
    this.persist(STORAGE_KEYS.INVENTORY_TX, this.inventoryTransactions);
    return true;
  }

  // --- Analytics ---
  public getAnalytics(): AdminAnalytics {
    const totalRevenue = this.orders.reduce((sum, o) => sum + (o.paymentStatus === 'SUCCEEDED' ? o.total : 0), 0);
    const totalOrders = this.orders.length;
    const totalCustomers = this.users.filter((u) => u.role === 'CUSTOMER').length + 12; // Including demo guests
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const lowStockCount = this.products.filter((p) => p.stock <= 5).length;

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    for (const order of this.orders) {
      for (const item of order.items) {
        const prod = this.getProductById(item.productId);
        const cat = prod?.categoryName || 'General';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + item.totalPrice;
      }
    }

    const salesByCategory = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0,
    }));

    // Top selling products
    const productSalesMap: Record<string, { product: Product; unitsSold: number; revenue: number }> = {};
    for (const order of this.orders) {
      for (const item of order.items) {
        const prod = this.getProductById(item.productId);
        if (prod) {
          if (!productSalesMap[prod.id]) {
            productSalesMap[prod.id] = { product: prod, unitsSold: 0, revenue: 0 };
          }
          productSalesMap[prod.id].unitsSold += item.quantity;
          productSalesMap[prod.id].revenue += item.totalPrice;
        }
      }
    }

    const topSellingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Revenue by day (last 7 days demo metrics)
    const revenueByDay = [
      { date: 'Mon', amount: 3240 },
      { date: 'Tue', amount: 4890 },
      { date: 'Wed', amount: 3750 },
      { date: 'Thu', amount: 6120 },
      { date: 'Fri', amount: 7800 },
      { date: 'Sat', amount: 9240 },
      { date: 'Sun', amount: 5410 },
    ];

    return {
      totalRevenue,
      revenueChangePercent: 18.4,
      totalOrders,
      ordersChangePercent: 12.1,
      totalCustomers,
      customersChangePercent: 24.6,
      averageOrderValue,
      lowStockCount,
      revenueByDay,
      salesByCategory,
      recentOrders: this.orders.slice(0, 8),
      topSellingProducts,
    };
  }
}

export const db = new Database();
