import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { db } from '../lib/db';
import { Product, Order, Review, Category, Role } from '../types';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Layers,
  MessageSquare,
  Tag,
  Users,
  AlertTriangle,
  TrendingUp,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  RotateCcw,
  Shield,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpDown,
  FolderPlus,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { currentUser, switchRole, addToast, navigate } = useStore();
  const { t, language } = useTranslation();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'products' | 'categories' | 'orders' | 'inventory' | 'users'
  >('overview');

  // Trigger state refreshes
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  // Search & Filter within dashboard
  const [productSearch, setProductSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  // Modal states for Product Add/Edit
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    slug: '',
    tagline: '',
    description: '',
    price: 950,
    compareAtPrice: 1100,
    sku: '',
    stock: 15,
    categoryId: 'cat_timepieces',
    materials: 'Stainless Steel, Sapphire Glass',
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80',
  });

  // Modal states for Category Add/Edit
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
  });

  // Inventory adjustment modal
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState(5);
  const [stockReason, setStockReason] = useState('Artisanal workshop replenishment');

  // Authorization Gate (Only authenticated Admin can access)
  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-rose-950/40 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
          <Shield className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="font-serif-luxury text-3xl font-bold text-[#F5F5F5]">
            {language === 'ar' ? 'غير مصرح بالدخول — لوحة الإدارة للمسؤول فقط' : '403 — Administrator Access Only'}
          </h2>
          <p className="text-xs text-[#9CA3AF] max-w-md mx-auto leading-relaxed">
            {language === 'ar'
              ? 'لوحة التحكم والعمليات مخصصة حصرياً للمسؤول (Admin). يرجى تسجيل الدخول بحساب مسؤول للوصول إلى لوحة الإدارة.'
              : 'This administrative console is restricted exclusively to Administrators. Please sign in with administrator credentials to proceed.'}
          </p>
        </div>

        <div className="pt-4 flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('login')}
            className="px-6 py-2.5 rounded-lg bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer"
          >
            {language === 'ar' ? 'تسجيل الدخول كمسؤول' : 'Sign In as Administrator'}
          </button>
          <button
            onClick={() => navigate('home')}
            className="px-6 py-2.5 rounded-lg bg-[#171A1F] border border-[#242831] hover:border-[#C9A961] text-[#F5F5F5] text-xs font-semibold transition-colors cursor-pointer"
          >
            {language === 'ar' ? 'العودة للرئيسية' : 'Return to Home'}
          </button>
        </div>
      </div>
    );
  }

  const isSuperAdmin = currentUser.role === 'ADMIN';
  const analytics = db.getAnalytics();
  const rawProducts = db.getProducts({ sortBy: 'newest' });
  const categories = db.getCategories();
  const rawOrders = db.getOrders();
  const reviews = db.getAllReviews();
  const inventoryTx = db.getInventoryTransactions();

  // Filter products by search
  const filteredProducts = rawProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.categoryName.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Filter orders by search
  const filteredOrders = rawOrders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerEmail.toLowerCase().includes(orderSearch.toLowerCase())
  );

  // --- Handlers: Products ---
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      slug: '',
      tagline: '',
      description: '',
      price: 950,
      compareAtPrice: 1100,
      sku: `NX-${Date.now().toString().slice(-4)}`,
      stock: 15,
      categoryId: categories[0]?.id || 'cat_timepieces',
      materials: 'Cold-Rolled 316L, Sapphire Glass',
      imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80',
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    try {
      setEditingProduct(prod);
      const materialsStr = Array.isArray(prod.materials)
        ? prod.materials.join(', ')
        : typeof prod.materials === 'string'
        ? prod.materials
        : '';

      const imageStr =
        Array.isArray(prod.images) && prod.images[0]?.url
          ? prod.images[0].url
          : typeof (prod as any).imageUrl === 'string'
          ? (prod as any).imageUrl
          : 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80';

      setProductForm({
        name: prod.name || '',
        slug: prod.slug || '',
        tagline: prod.tagline || '',
        description: prod.description || '',
        price: prod.price ?? 0,
        compareAtPrice: prod.compareAtPrice || 0,
        sku: prod.sku || '',
        stock: prod.stock ?? 0,
        categoryId: prod.categoryId || categories[0]?.id || 'cat_timepieces',
        materials: materialsStr,
        imageUrl: imageStr,
      });
      setIsProductModalOpen(true);
    } catch (err) {
      console.error('Failed to open product edit modal:', err);
      // Fallback open modal anyway
      setEditingProduct(prod);
      setIsProductModalOpen(true);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const materialsList = typeof productForm.materials === 'string'
        ? productForm.materials.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      db.saveProduct({
        id: editingProduct?.id,
        name: productForm.name.trim(),
        slug: productForm.slug?.trim() || productForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        tagline: productForm.tagline.trim(),
        description: productForm.description.trim(),
        price: Number(productForm.price) || 0,
        compareAtPrice: Number(productForm.compareAtPrice) > 0 ? Number(productForm.compareAtPrice) : undefined,
        sku: productForm.sku.trim(),
        stock: Math.max(0, Number(productForm.stock) || 0),
        categoryId: productForm.categoryId,
        materials: materialsList,
        images: [
          {
            id: editingProduct?.images?.[0]?.id || `img_${Date.now()}`,
            url: productForm.imageUrl || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80',
            altText: productForm.name,
            isPrimary: true,
            order: 0,
          },
        ],
      });

      setIsProductModalOpen(false);
      refresh();
      addToast({
        type: 'success',
        title: language === 'ar'
          ? (editingProduct ? 'تم تحديث المنتج بنجاح' : 'تمت إضافة المنتج بنجاح')
          : (editingProduct ? 'Product Updated' : 'Product Added'),
        message: `${productForm.name} ${language === 'ar' ? 'تم حفظ التعديلات في النظام.' : 'saved successfully.'}`,
      });
    } catch (err: any) {
      console.error('Error saving product:', err);
      addToast({
        type: 'error',
        title: language === 'ar' ? 'خطأ في حفظ المنتج' : 'Save Failed',
        message: err?.message || 'Could not save product',
      });
    }
  };

  const handleDeleteProduct = (id: string, name: string) => {
    if (confirm(`Are you certain you wish to delete "${name}" from the catalog?`)) {
      db.deleteProduct(id);
      refresh();
      addToast({
        type: 'info',
        title: 'Product Deleted',
        message: `${name} has been removed from the registry.`,
      });
    }
  };

  const handleQuickStockChange = (productId: string, delta: number) => {
    db.adjustStock(productId, delta, 'Quick dashboard stock modification');
    refresh();
    addToast({
      type: 'success',
      title: 'Stock Updated',
      message: `Stock adjusted by ${delta > 0 ? '+' : ''}${delta}.`,
    });
  };

  const handleAdjustStockModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForStock) return;
    db.adjustStock(selectedProductForStock.id, stockDelta, stockReason);
    setIsStockModalOpen(false);
    refresh();
    addToast({
      type: 'success',
      title: 'Stock Ledger Updated',
      message: `${selectedProductForStock.name} inventory changed by ${stockDelta > 0 ? '+' : ''}${stockDelta}.`,
    });
  };

  // --- Handlers: Categories ---
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      slug: '',
      description: '',
      imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveCategory({
      id: editingCategory?.id,
      name: categoryForm.name,
      slug: categoryForm.slug || categoryForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: categoryForm.description,
      imageUrl: categoryForm.imageUrl,
    });
    setIsCategoryModalOpen(false);
    refresh();
    addToast({
      type: 'success',
      title: editingCategory ? 'Category Updated' : 'Category Created',
      message: `${categoryForm.name} saved.`,
    });
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (confirm(`Delete atelier "${name}"?`)) {
      db.deleteCategory(id);
      refresh();
      addToast({
        type: 'info',
        title: 'Category Removed',
        message: `${name} has been deleted.`,
      });
    }
  };

  // --- Handlers: Orders ---
  const handleUpdateOrderStatus = (orderId: string, status: Order['status']) => {
    db.updateOrderStatus(orderId, status);
    refresh();
    addToast({
      type: 'success',
      title: 'Order Status Changed',
      message: `Order transitioned to status: ${status}`,
    });
  };

  const handleDeleteOrder = (orderId: string, orderNumber: string) => {
    if (confirm(`Delete order ${orderNumber}? This will remove it from the ledger.`)) {
      db.deleteOrder(orderId);
      refresh();
      addToast({
        type: 'info',
        title: 'Order Deleted',
        message: `Order ${orderNumber} removed from ledger.`,
      });
    }
  };

  const handleResetData = () => {
    if (confirm('Reset database to clean initial demo state? All local edits will revert to default.')) {
      db.resetToDemoState();
      refresh();
      addToast({
        type: 'info',
        title: 'Demo Database Restored',
        message: 'Reverted to pristine seed records.',
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Persona Badge */}
      <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#C9A961]/20 text-[#C9A961] uppercase tracking-wider font-semibold">
              {currentUser.role} {language === 'ar' ? 'لوحة التحكم' : 'CONSOLE'}
            </span>
            <span className="text-xs text-[#9CA3AF]">
              {language === 'ar' ? 'تم الدخول باسم:' : 'Logged in as:'}{' '}
              <strong className="text-[#F5F5F5]">{currentUser.name}</strong> ({currentUser.email})
            </span>
          </div>
          <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#F5F5F5] mt-1">
            {t.dashboard.title}
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            {t.dashboard.suiteSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleResetData}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-[#121418] border border-[#242831] hover:border-amber-400/50 text-xs text-[#9CA3AF] hover:text-amber-300 transition-colors cursor-pointer"
            title={t.dashboard.resetDemo}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.dashboard.resetDemo}</span>
          </button>

          <button
            onClick={() => navigate('shop')}
            className="px-4 py-2 rounded bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {t.dashboard.viewStorefront}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-[#242831] pb-2 scrollbar-none text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#C9A961] text-[#0F1113]'
              : 'text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#171A1F]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>{t.dashboard.tabOverview}</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'products'
              ? 'bg-[#C9A961] text-[#0F1113]'
              : 'text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#171A1F]'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{t.dashboard.tabProducts} ({rawProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-[#C9A961] text-[#0F1113]'
              : 'text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#171A1F]'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>{t.dashboard.tabCategories} ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-[#C9A961] text-[#0F1113]'
              : 'text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#171A1F]'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>{t.dashboard.tabOrders} ({rawOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-[#C9A961] text-[#0F1113]'
              : 'text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#171A1F]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t.dashboard.tabInventory}</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#C9A961] text-[#0F1113]'
                : 'text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#171A1F]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{t.dashboard.tabUsers}</span>
          </button>
        )}
      </div>

      {/* --- TAB 1: OVERVIEW & ANALYTICS --- */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Key KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-2">
              <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">Gross Commission Revenue</span>
              <div className="text-2xl font-bold font-mono text-[#F5F5F5]">
                ${analytics.totalRevenue.toLocaleString()}
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+{analytics.revenueChangePercent}% vs previous cohort</span>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-2">
              <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">Total Orders Logged</span>
              <div className="text-2xl font-bold font-mono text-[#F5F5F5]">
                {analytics.totalOrders}
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+{analytics.ordersChangePercent}% acquisition velocity</span>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-2">
              <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">Average Commission Value</span>
              <div className="text-2xl font-bold font-mono text-[#F5F5F5]">
                ${analytics.averageOrderValue.toLocaleString()}
              </div>
              <div className="text-xs text-[#9CA3AF]">High-ticket luxury benchmark</div>
            </div>

            <div className="p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-2">
              <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">Critical Low Stock Alerts</span>
              <div className="text-2xl font-bold font-mono text-amber-400">
                {analytics.lowStockCount}
              </div>
              <div className="text-xs text-amber-400/80">Artifacts with &le; 5 units</div>
            </div>
          </div>

          {/* Revenue Chart Simulation & Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Revenue Trend Visual */}
            <div className="lg:col-span-7 p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider">
                  Weekly Volume Velocity
                </h3>
                <span className="text-xs text-[#9CA3AF]">Trailing 7 Days</span>
              </div>

              <div className="h-48 flex items-end gap-3 sm:gap-6 pt-4 border-b border-[#242831]">
                {analytics.revenueByDay.map((day) => {
                  const maxAmount = 10000;
                  const heightPercent = Math.min(100, Math.round((day.amount / maxAmount) * 100));
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[10px] font-mono text-[#9CA3AF] hidden sm:block">
                        ${(day.amount / 1000).toFixed(1)}k
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full bg-[#C9A961]/80 hover:bg-[#C9A961] rounded-t transition-all"
                      />
                      <span className="text-xs font-mono text-[#F5F5F5]">{day.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Share */}
            <div className="lg:col-span-5 p-6 rounded-xl bg-[#171A1F] border border-[#242831] space-y-4">
              <h3 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider">
                Sales by Atelier Guild
              </h3>

              <div className="space-y-3 pt-2">
                {analytics.salesByCategory.map((cat) => (
                  <div key={cat.category} className="space-y-1 text-xs">
                    <div className="flex justify-between text-[#F5F5F5]">
                      <span>{cat.category}</span>
                      <span className="font-mono text-[#C9A961]">
                        ${cat.amount.toLocaleString()} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#121418] overflow-hidden">
                      <div
                        style={{ width: `${Math.max(5, cat.percentage)}%` }}
                        className="h-full bg-[#C9A961] rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: PRODUCTS CRUD --- */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#F5F5F5] uppercase tracking-wider">
                {language === 'ar' ? 'سجل المنتجات والكتالوج' : 'Catalog Artifact Registry'}
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                {language === 'ar' ? 'إضافة وتعديل وتحديث المخزون أو حذف المنتجات لحظياً وبشكل فوري.' : 'Add, edit, adjust stock, or delete artifacts in real time.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={t.dashboard.searchProducts}
                  className="bg-[#171A1F] border border-[#242831] text-xs text-[#F5F5F5] pl-8 pr-3 rtl:pl-3 rtl:pr-8 py-2 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <button
                onClick={handleOpenAddProduct}
                className="px-4 py-2.5 rounded bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] font-semibold text-xs tracking-wider uppercase flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{t.dashboard.addProduct}</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#242831] overflow-hidden bg-[#171A1F]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left rtl:text-right text-xs">
                <thead className="bg-[#121418] text-[#9CA3AF] uppercase font-mono tracking-wider border-b border-[#242831]">
                  <tr>
                    <th className="p-4">{language === 'ar' ? 'المنتج' : 'Artifact'}</th>
                    <th className="p-4">{t.dashboard.sku}</th>
                    <th className="p-4">{t.dashboard.category}</th>
                    <th className="p-4">{t.dashboard.price}</th>
                    <th className="p-4">{language === 'ar' ? 'تعديل المخزون' : 'Quick Stock'}</th>
                    <th className="p-4">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="p-4 text-right rtl:text-left">{t.dashboard.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242831] text-[#F5F5F5]">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-[#1E2229]/60 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.images?.[0]?.url || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=300&q=80'}
                            alt={p.name}
                            className="w-10 h-10 rounded object-cover border border-[#242831] shrink-0"
                          />
                          <div>
                            <div className="font-medium text-[#F5F5F5]">{p.name}</div>
                            <div className="text-[11px] text-[#9CA3AF] line-clamp-1">{p.tagline}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-[#9CA3AF]">{p.sku}</td>
                      <td className="p-4 text-[#9CA3AF]">{p.categoryName}</td>
                      <td className="p-4 font-mono font-semibold">${p.price.toLocaleString()}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuickStockChange(p.id, -1)}
                            className="w-7 h-7 rounded bg-[#121418] hover:bg-[#242831] border border-[#242831] flex items-center justify-center text-[#9CA3AF] hover:text-white cursor-pointer"
                            title="Decrease Stock"
                          >
                            -
                          </button>
                          <span
                            className={`font-mono font-semibold w-12 text-center ${
                              p.stock <= 5 ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {p.stock}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuickStockChange(p.id, 1)}
                            className="w-7 h-7 rounded bg-[#121418] hover:bg-[#242831] border border-[#242831] flex items-center justify-center text-[#9CA3AF] hover:text-white cursor-pointer"
                            title="Increase Stock"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 text-right rtl:text-left">
                        <div className="flex items-center justify-end rtl:justify-start gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditProduct(p);
                            }}
                            className="p-2 rounded bg-[#121418] hover:bg-[#242831] border border-[#242831] hover:border-[#C9A961] text-[#9CA3AF] hover:text-[#C9A961] transition-colors cursor-pointer"
                            title={language === 'ar' ? 'تعديل المنتج' : 'Edit Artifact'}
                            aria-label={language === 'ar' ? 'تعديل المنتج' : 'Edit Artifact'}
                          >
                            <Edit3 className="w-4 h-4 pointer-events-none" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(p.id, p.name);
                            }}
                            className="p-2 rounded bg-[#121418] hover:bg-[#242831] border border-[#242831] hover:border-rose-500/50 text-[#9CA3AF] hover:text-rose-400 transition-colors cursor-pointer"
                            title={language === 'ar' ? 'حذف المنتج' : 'Delete Artifact'}
                            aria-label={language === 'ar' ? 'حذف المنتج' : 'Delete Artifact'}
                          >
                            <Trash2 className="w-4 h-4 pointer-events-none" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: CATEGORIES & ATELIERS CRUD --- */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#F5F5F5] uppercase tracking-wider">
                Ateliers & Categories Management
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Add, modify or delete atelier classifications and descriptions.
              </p>
            </div>

            <button
              onClick={handleOpenAddCategory}
              className="px-4 py-2.5 rounded bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] font-semibold text-xs tracking-wider uppercase flex items-center gap-1.5 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Add New Atelier</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-5 rounded-xl bg-[#171A1F] border border-[#242831] space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <img
                    src={cat.imageUrl}
                    alt={cat.name}
                    className="w-full h-32 rounded-lg object-cover border border-[#242831]"
                  />
                  <div>
                    <h4 className="font-serif-luxury text-base font-bold text-[#F5F5F5]">
                      {cat.name}
                    </h4>
                    <span className="font-mono text-[11px] text-[#C9A961]">slug: {cat.slug}</span>
                    <p className="text-xs text-[#9CA3AF] mt-1 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#242831] flex items-center justify-between">
                  <span className="text-[11px] text-[#9CA3AF] font-mono">
                    {cat.itemCount} items
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditCategory(cat)}
                      className="p-1.5 rounded hover:bg-[#242831] text-[#9CA3AF] hover:text-[#C9A961] transition-colors"
                      title="Edit Category"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="p-1.5 rounded hover:bg-[#242831] text-[#9CA3AF] hover:text-rose-400 transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 4: ORDERS MANAGEMENT --- */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#F5F5F5] uppercase tracking-wider">
                Order Ledger & Fulfillment
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Manage orders, update status or delete completed records.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search order ref or client..."
                className="bg-[#171A1F] border border-[#242831] text-xs text-[#F5F5F5] pl-8 pr-3 py-2 rounded outline-none focus:border-[#C9A961]"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#242831] overflow-hidden bg-[#171A1F]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left rtl:text-right text-xs">
                <thead className="bg-[#121418] text-[#9CA3AF] uppercase font-mono tracking-wider border-b border-[#242831]">
                  <tr>
                    <th className="p-4">Order Ref</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Advance Status</th>
                    <th className="p-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242831] text-[#F5F5F5]">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#1E2229]/60 transition-colors">
                      <td className="p-4 font-mono font-bold text-[#C9A961]">{o.orderNumber}</td>
                      <td className="p-4 text-[#9CA3AF]">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-[#F5F5F5]">{o.customerName}</div>
                        <div className="text-[11px] text-[#9CA3AF]">{o.customerEmail}</div>
                      </td>
                      <td className="p-4 font-mono font-semibold">${o.total.toLocaleString()}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                            o.status === 'DELIVERED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : o.status === 'SHIPPED'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                              : 'bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/30'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <select
                          value={o.status}
                          onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value as any)}
                          className="bg-[#121418] border border-[#242831] rounded px-2.5 py-1 text-xs text-[#F5F5F5] outline-none focus:border-[#C9A961]"
                        >
                          <option value="PAID">PAID</option>
                          <option value="PROCESSING">PROCESSING</option>
                          <option value="SHIPPED">SHIPPED</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteOrder(o.id, o.orderNumber)}
                          className="p-1.5 rounded hover:bg-[#242831] text-[#9CA3AF] hover:text-rose-400 transition-colors"
                          title="Delete Order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 5: INVENTORY & LOGS --- */}
      {activeTab === 'inventory' && (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#F5F5F5] uppercase tracking-wider">
                Real-Time Stock Audit & Ledger
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Adjust stock levels manually with authenticated audit trails.
              </p>
            </div>
          </div>

          {/* Quick Adjustment Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rawProducts.slice(0, 6).map((prod) => (
              <div
                key={prod.id}
                className="p-4 rounded-lg bg-[#171A1F] border border-[#242831] flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-medium text-[#F5F5F5] line-clamp-1">{prod.name}</h4>
                  <div className="text-[11px] font-mono text-[#9CA3AF] mt-0.5">
                    Current: <strong className="text-[#C9A961]">{prod.stock} units</strong>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedProductForStock(prod);
                    setIsStockModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded bg-[#121418] border border-[#242831] hover:border-[#C9A961] text-xs text-[#F5F5F5] transition-colors cursor-pointer"
                >
                  Adjust
                </button>
              </div>
            ))}
          </div>

          {/* Transaction Log Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider">
              Immutable Inventory Transaction Ledger
            </h3>
            <div className="rounded-xl border border-[#242831] overflow-hidden bg-[#171A1F]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left rtl:text-right text-xs">
                  <thead className="bg-[#121418] text-[#9CA3AF] uppercase font-mono tracking-wider border-b border-[#242831]">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Artifact</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Qty</th>
                      <th className="p-4">Resulting Stock</th>
                      <th className="p-4">Reason / Authority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242831] text-[#F5F5F5]">
                    {inventoryTx.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[#1E2229]/60 transition-colors">
                        <td className="p-4 text-[#9CA3AF] font-mono">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="p-4 font-medium">{tx.productName}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              tx.type === 'IN'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-semibold">
                          {tx.type === 'IN' ? `+${tx.quantity}` : `-${tx.quantity}`}
                        </td>
                        <td className="p-4 font-mono text-[#C9A961]">{tx.stockAfter}</td>
                        <td className="p-4 text-[#9CA3AF]">
                          {tx.reason} · <span className="text-[#F5F5F5]">{tx.performedBy}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 6: USERS & RBAC (ADMIN ONLY) --- */}
      {activeTab === 'users' && isSuperAdmin && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#F5F5F5] uppercase tracking-wider">
              Identity & Role-Based Access Control (RBAC)
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              Authorized administrators can audit active credentials and test persona switches.
            </p>
          </div>

          <div className="rounded-xl border border-[#242831] overflow-hidden bg-[#171A1F]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left rtl:text-right text-xs">
                <thead className="bg-[#121418] text-[#9CA3AF] uppercase font-mono tracking-wider border-b border-[#242831]">
                  <tr>
                    <th className="p-4">{language === 'ar' ? 'المستخدم' : 'User'}</th>
                    <th className="p-4">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                    <th className="p-4">{language === 'ar' ? 'الدور المحدد' : 'Assigned Role'}</th>
                    <th className="p-4 text-right rtl:text-left">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242831] text-[#F5F5F5]">
                {db.getAllUsers().map((u) => (
                  <tr key={u.id} className="hover:bg-[#1E2229]/60 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                          alt={u.name}
                          className="w-8 h-8 rounded-full object-cover border border-[#242831]"
                        />
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-[#9CA3AF]">{u.email}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-[#C9A961]/20 text-[#C9A961] font-mono font-semibold text-[10px]">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-xs text-[#9CA3AF] font-mono">
                        {u.role === 'ADMIN' ? (language === 'ar' ? 'صلاحيات كاملة' : 'Full Authority') : (language === 'ar' ? 'حساب نشط' : 'Active Account')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

      {/* --- MODAL: PRODUCT ADD / EDIT --- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4">
          <div
            onClick={() => setIsProductModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-2xl bg-[#171A1F] border border-[#242831] rounded-xl shadow-2xl p-4 sm:p-7 z-10 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#242831] pb-3 sticky top-0 bg-[#171A1F] z-10">
              <h3 className="font-serif-luxury text-lg sm:text-xl font-bold text-[#F5F5F5]">
                {editingProduct
                  ? (language === 'ar' ? 'تعديل بيانات المنتج' : 'Edit Artifact Commission')
                  : (language === 'ar' ? 'إضافة منتج جديد للكتالوج' : 'Commission New Artifact')}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded hover:bg-[#242831] text-[#9CA3AF] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                title={language === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              {/* Product Image URL & Preview */}
              <div className="p-3 sm:p-4 rounded-xl bg-[#121418] border border-[#242831] space-y-3">
                <label className="text-[#F5F5F5] font-medium block">
                  {language === 'ar' ? 'صورة المنتج (رابط مباشر URL)' : 'Product Image URL'}
                </label>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
                  <div className="w-16 h-16 rounded-lg bg-[#171A1F] border border-[#242831] overflow-hidden shrink-0">
                    <img
                      src={productForm.imageUrl || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=300&q=80'}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=300&q=80';
                      }}
                    />
                  </div>
                  <div className="flex-1 w-full space-y-1.5">
                    <input
                      type="url"
                      value={productForm.imageUrl}
                      onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full bg-[#171A1F] border border-[#242831] text-[#F5F5F5] px-3.5 py-2 rounded outline-none focus:border-[#C9A961]"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] text-[#9CA3AF] mr-1">{language === 'ar' ? 'نماذج جاهزة:' : 'Presets:'}</span>
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80' })}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#171A1F] hover:bg-[#242831] text-[#C9A961] border border-[#242831] cursor-pointer"
                      >
                        {language === 'ar' ? 'ساعات' : 'Watch'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1000&q=80' })}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#171A1F] hover:bg-[#242831] text-[#C9A961] border border-[#242831] cursor-pointer"
                      >
                        {language === 'ar' ? 'صوتيات' : 'Audio'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=80' })}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#171A1F] hover:bg-[#242831] text-[#C9A961] border border-[#242831] cursor-pointer"
                      >
                        {language === 'ar' ? 'جلديات' : 'Leather'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1000&q=80' })}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#171A1F] hover:bg-[#242831] text-[#C9A961] border border-[#242831] cursor-pointer"
                      >
                        {language === 'ar' ? 'مكتبية' : 'Workspace'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[#9CA3AF] block mb-1 font-medium">{language === 'ar' ? 'اسم المنتج' : 'Artifact Name'}</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    required
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[#9CA3AF] block mb-1 font-medium">{language === 'ar' ? 'نبذة تعريفية سريعة' : 'Tagline'}</label>
                  <input
                    type="text"
                    value={productForm.tagline}
                    onChange={(e) => setProductForm({ ...productForm, tagline: e.target.value })}
                    required
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                  />
                </div>

                <div>
                  <label className="text-[#9CA3AF] block mb-1 font-medium">{language === 'ar' ? 'السعر ($ USD)' : 'Price ($ USD)'}</label>
                  <input
                    type="number"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    required
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                  />
                </div>

                <div>
                  <label className="text-[#9CA3AF] block mb-1 font-medium">{language === 'ar' ? 'السعر السابق المقارن ($ USD)' : 'Compare Price ($ USD)'}</label>
                  <input
                    type="number"
                    value={productForm.compareAtPrice}
                    onChange={(e) =>
                      setProductForm({ ...productForm, compareAtPrice: Number(e.target.value) })
                    }
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                  />
                </div>

                <div>
                  <label className="text-[#9CA3AF] block mb-1 font-medium">{language === 'ar' ? 'رمز SKU' : 'SKU'}</label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    required
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded font-mono outline-none focus:border-[#C9A961]"
                  />
                </div>

                <div>
                  <label className="text-[#9CA3AF] block mb-1 font-medium">{language === 'ar' ? 'الكمية بالمخزون' : 'Stock Count'}</label>
                  <input
                    type="number"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                    required
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[#9CA3AF] block mb-1 font-medium">{language === 'ar' ? 'القسم / التصنيف' : 'Atelier Discipline'}</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#171A1F]">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[#9CA3AF] block mb-1 font-medium">{language === 'ar' ? 'المواد والمواصفات (مفصولة بفواصل)' : 'Materials & Spec'}</label>
                  <input
                    type="text"
                    value={productForm.materials}
                    onChange={(e) => setProductForm({ ...productForm, materials: e.target.value })}
                    placeholder="Titanium, Sapphire, Platinum"
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[#9CA3AF] block mb-1 font-medium">{language === 'ar' ? 'الوصف التفصيلي' : 'Description'}</label>
                  <textarea
                    rows={3}
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    required
                    className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#242831] sticky bottom-0 bg-[#171A1F] py-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2.5 rounded bg-[#121418] border border-[#242831] text-[#9CA3AF] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                >
                  {t.dashboard.cancel}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                >
                  {t.dashboard.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CATEGORY ADD / EDIT --- */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            onClick={() => setIsCategoryModalOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md bg-[#171A1F] border border-[#242831] rounded-xl shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-[#242831] pb-3">
              <h3 className="font-serif-luxury text-lg font-bold text-[#F5F5F5]">
                {editingCategory ? 'Edit Atelier' : 'Add New Atelier'}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-[#9CA3AF] hover:text-[#F5F5F5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="text-[#9CA3AF] block mb-1">Atelier Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g. Masterwork Ceramics"
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div>
                <label className="text-[#9CA3AF] block mb-1">URL Slug</label>
                <input
                  type="text"
                  value={categoryForm.slug}
                  onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                  placeholder="e.g. masterwork-ceramics"
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div>
                <label className="text-[#9CA3AF] block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Brief atelier craft summary..."
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div>
                <label className="text-[#9CA3AF] block mb-1">Cover Image URL</label>
                <input
                  type="text"
                  value={categoryForm.imageUrl}
                  onChange={(e) => setCategoryForm({ ...categoryForm, imageUrl: e.target.value })}
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#242831]">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded bg-[#121418] text-[#9CA3AF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-[#C9A961] text-[#0F1113] font-semibold uppercase tracking-wider cursor-pointer"
                >
                  Save Atelier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: STOCK ADJUSTMENT --- */}
      {isStockModalOpen && selectedProductForStock && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            onClick={() => setIsStockModalOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md bg-[#171A1F] border border-[#242831] rounded-xl shadow-2xl p-6 z-10 space-y-4">
            <h3 className="font-serif-luxury text-lg font-bold text-[#F5F5F5]">
              Adjust Stock: {selectedProductForStock.name}
            </h3>

            <form onSubmit={handleAdjustStockModal} className="space-y-4 text-xs">
              <div>
                <label className="text-[#9CA3AF] block mb-1">
                  Quantity Adjustment (+ to add, - to reduce)
                </label>
                <input
                  type="number"
                  value={stockDelta}
                  onChange={(e) => setStockDelta(Number(e.target.value))}
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded font-mono text-sm outline-none focus:border-[#C9A961]"
                />
              </div>

              <div>
                <label className="text-[#9CA3AF] block mb-1">Audit Ledger Reason</label>
                <input
                  type="text"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  required
                  className="w-full bg-[#121418] border border-[#242831] text-[#F5F5F5] px-3.5 py-2.5 rounded outline-none focus:border-[#C9A961]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2 rounded bg-[#121418] text-[#9CA3AF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-[#C9A961] text-[#0F1113] font-semibold uppercase tracking-wider cursor-pointer"
                >
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
