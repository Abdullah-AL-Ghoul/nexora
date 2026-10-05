import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { fetchCategories, fetchProducts, ApiCategory, ApiProduct } from '../lib/api';
import { Category, Product } from '../types';
import { ProductGrid } from '../components/store/ProductGrid';
import { Search, ArrowUpDown, X, Check, Loader2, AlertTriangle } from 'lucide-react';

type LoadState = 'loading' | 'error' | 'ready';

// Map snake_case API fields to the client Category shape used by the UI.
const toCategory = (c: ApiCategory): Category => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  description: c.description,
  imageUrl: c.image_url,
  itemCount: c.item_count,
});

// ApiProduct already matches the client Product shape apart from `status`, the
// nullable `compareAtPrice`, and variants whose productId can be missing —
// normalize all three to the client Product type.
const toProduct = (p: ApiProduct): Product => ({
  ...p,
  compareAtPrice: p.compareAtPrice ?? undefined,
  status: p.status as Product['status'],
  variants: p.variants.map((v) => ({ ...v, productId: v.productId ?? p.id })),
});

export const ShopPage: React.FC = () => {
  const {
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
  } = useStore();
  const { t, language, localizeCategory } = useTranslation();

  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Server-sourced data
  const [rawCategories, setRawCategories] = useState<ApiCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProductCount, setTotalProductCount] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Debounced search to avoid firing a request on every keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const categories = rawCategories.map(toCategory).map(localizeCategory);

  // Smart deterministic search parsing check (e.g. "under 500", "audio", "leather")
  const parsedFilters = useMemo(() => {
    let effectiveMax = maxPrice;
    let query = debouncedQuery;

    // Check for "under X" or "< X" in query
    const underMatch = query.match(/(?:under|<)\s*(\d+)/i);
    if (underMatch && underMatch[1]) {
      effectiveMax = parseInt(underMatch[1], 10);
      query = query.replace(/(?:under|<)\s*\d+/i, '').trim();
    }

    return { effectiveMax, cleanedQuery: query };
  }, [debouncedQuery, maxPrice]);

  const load = useCallback(async () => {
    setLoadState('loading');
    setError('');
    try {
      const [rawCats, items, allItems] = await Promise.all([
        fetchCategories(),
        fetchProducts({
          categorySlug: selectedCategory,
          search: parsedFilters.cleanedQuery,
          minPrice,
          maxPrice: parsedFilters.effectiveMax,
          sortBy,
          inStockOnly,
        }),
        fetchProducts(),
      ]);
      setRawCategories(rawCats);
      setTotalProductCount(allItems.length);
      setProducts(items.map(toProduct));
      setCurrentPage(1);
      setLoadState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
      setLoadState('error');
    }
  }, [
    selectedCategory,
    parsedFilters.cleanedQuery,
    parsedFilters.effectiveMax,
    minPrice,
    sortBy,
    inStockOnly,
    reloadKey,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(products.length / itemsPerPage);
  const paginatedProducts = products.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleCategorySelect = (slug: string) => {
    setSelectedCategory(slug);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setInStockOnly(false);
    setCurrentPage(1);
  };

  const handleRetry = () => setReloadKey((k) => k + 1);

  const currentCategoryObj = categories.find((c) => c.slug === selectedCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="border-b border-line pb-8">
        <span className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
          {language === 'ar' ? 'التشكيلة المختارة' : 'Curated Catalog'}
        </span>
        <h1 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-fg mt-1">
          {selectedCategory === 'all'
            ? t.shop.title
            : currentCategoryObj?.name || t.shop.title}
        </h1>
        <p className="text-xs text-fg-muted mt-2 max-w-2xl leading-relaxed">
          {selectedCategory === 'all'
            ? t.shop.subtitle
            : currentCategoryObj?.description}
        </p>
      </div>

      {/* Filter and Control Bar */}
      <div className="space-y-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => handleCategorySelect('all')}
            className={`px-4 py-2 rounded text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-gold text-ink'
                : 'bg-surface text-fg-muted hover:text-fg border border-line'
            }`}
          >
            {t.shop.allCategories} ({totalProductCount})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.slug)}
              className={`px-4 py-2 rounded text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-gold text-ink'
                  : 'bg-surface text-fg-muted hover:text-fg border border-line'
              }`}
            >
              {cat.name} ({cat.itemCount})
            </button>
          ))}
        </div>

        {/* Search, Price & Sort Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-lg bg-surface border border-line">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-fg-muted absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t.shop.searchPlaceholder}
              className="w-full bg-raised border border-line text-xs text-fg pl-9 pr-8 rtl:pl-8 rtl:pr-9 py-2 rounded outline-none focus:border-gold placeholder:text-fg-faint"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rtl:right-auto rtl:left-2.5 text-fg-faint hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Price Inputs */}
            <div className="flex items-center gap-1.5 text-xs text-fg-muted">
              <span>{language === 'ar' ? 'السعر ($):' : 'Price ($):'}</span>
              <input
                type="number"
                placeholder={language === 'ar' ? 'الأدنى' : 'Min'}
                value={minPrice ?? ''}
                onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                className="w-16 bg-raised border border-line text-xs text-fg px-2 py-1.5 rounded outline-none focus:border-gold"
              />
              <span>—</span>
              <input
                type="number"
                placeholder={language === 'ar' ? 'الأعلى' : 'Max'}
                value={maxPrice ?? ''}
                onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                className="w-16 bg-raised border border-line text-xs text-fg px-2 py-1.5 rounded outline-none focus:border-gold"
              />
            </div>

            {/* In Stock Toggle */}
            <button
              onClick={() => setInStockOnly(!inStockOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors cursor-pointer ${
                inStockOnly
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-line bg-raised text-fg-muted hover:text-fg'
              }`}
            >
              <div
                className={`w-3 h-3 rounded flex items-center justify-center border ${
                  inStockOnly ? 'bg-gold border-gold' : 'border-fg-muted'
                }`}
              >
                {inStockOnly && <Check className="w-2.5 h-2.5 text-ink" />}
              </div>
              <span>{language === 'ar' ? 'المتوفر فقط' : 'In Stock'}</span>
            </button>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 text-xs bg-raised border border-line rounded px-3 py-1.5 text-fg-muted">
              <ArrowUpDown className="w-3.5 h-3.5 text-gold" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-fg outline-none text-xs cursor-pointer"
              >
                <option value="newest" className="bg-surface">{t.shop.sortNewest}</option>
                <option value="price-asc" className="bg-surface">{t.shop.sortPriceAsc}</option>
                <option value="price-desc" className="bg-surface">{t.shop.sortPriceDesc}</option>
                <option value="popular" className="bg-surface">{t.shop.sortPopular}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loadState === 'loading' && (
        <section className="flex items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-gold animate-spin" />
        </section>
      )}

      {/* Error State */}
      {loadState === 'error' && (
        <section>
          <div className="py-20 text-center space-y-4 rounded-xl bg-surface border border-line p-8 max-w-xl mx-auto my-8">
            <div className="w-14 h-14 rounded-full bg-raised border border-line flex items-center justify-center mx-auto text-gold">
              <AlertTriangle className="w-7 h-7 opacity-90" />
            </div>
            <h3 className="font-serif-luxury text-lg font-bold text-fg">
              {language === 'ar' ? 'تعذّر تحميل المنتجات' : "Couldn't Load Products"}
            </h3>
            {error && (
              <p className="text-xs text-fg-muted max-w-sm mx-auto leading-relaxed">
                {error}
              </p>
            )}
            <button
              onClick={handleRetry}
              className="px-6 py-2.5 rounded bg-gold text-ink hover:bg-gold-soft text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer"
            >
              {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        </section>
      )}

      {/* Products Grid + Pagination */}
      {loadState === 'ready' && (
        <>
          <ProductGrid
            products={paginatedProducts}
            onResetFilters={handleClearFilters}
            emptyTitle={t.shop.emptyTitle}
            emptyDescription={t.shop.emptyDescription}
          />

          {totalPages > 1 && (
            <div className="pt-8 border-t border-line flex items-center justify-between text-xs text-fg-muted">
              <div>
                {language === 'ar'
                  ? `عرض ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, products.length)} من أصل ${products.length} قطعة`
                  : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, products.length)} of ${products.length} artifacts`}
              </div>

              <div className="flex items-center gap-1.5">
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;
                  const isActive = currentPage === page;
                  return (
                    <button
                      key={page}
                      onClick={() => {
                        setCurrentPage(page);
                        window.scrollTo({ top: 200, behavior: 'smooth' });
                      }}
                      className={`w-8 h-8 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-gold text-ink font-bold'
                          : 'bg-surface border border-line text-fg hover:border-gold'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
