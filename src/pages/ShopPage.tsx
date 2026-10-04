import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { db } from '../lib/db';
import { ProductGrid } from '../components/store/ProductGrid';
import { Search, ArrowUpDown, X, Check } from 'lucide-react';

export const ShopPage: React.FC = () => {
  const {
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
  } = useStore();
  const { t, language, localizeCategory, getCategoryName } = useTranslation();

  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const rawCategories = db.getCategories();
  const categories = rawCategories.map(localizeCategory);

  // Smart deterministic search parsing check (e.g. "under 500", "audio", "leather")
  const parsedFilters = useMemo(() => {
    let effectiveMax = maxPrice;
    let query = searchQuery;

    // Check for "under X" or "< X" in query
    const underMatch = query.match(/(?:under|<)\s*(\d+)/i);
    if (underMatch && underMatch[1]) {
      effectiveMax = parseInt(underMatch[1], 10);
      query = query.replace(/(?:under|<)\s*\d+/i, '').trim();
    }

    return { effectiveMax, cleanedQuery: query };
  }, [searchQuery, maxPrice]);

  const filteredProducts = useMemo(() => {
    return db.getProducts({
      categorySlug: selectedCategory,
      search: parsedFilters.cleanedQuery,
      minPrice,
      maxPrice: parsedFilters.effectiveMax,
      sortBy,
      inStockOnly,
    });
  }, [selectedCategory, parsedFilters, minPrice, sortBy, inStockOnly]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
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

  const currentCategoryObj = categories.find((c) => c.slug === selectedCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="border-b border-[#242831] pb-8">
        <span className="text-xs uppercase tracking-[0.2em] text-[#C9A961] font-semibold">
          {language === 'ar' ? 'التشكيلة المختارة' : 'Curated Catalog'}
        </span>
        <h1 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-[#F5F5F5] mt-1">
          {selectedCategory === 'all'
            ? t.shop.title
            : currentCategoryObj?.name || t.shop.title}
        </h1>
        <p className="text-xs text-[#9CA3AF] mt-2 max-w-2xl leading-relaxed">
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
                ? 'bg-[#C9A961] text-[#0F1113]'
                : 'bg-[#171A1F] text-[#9CA3AF] hover:text-[#F5F5F5] border border-[#242831]'
            }`}
          >
            {t.shop.allCategories} ({db.getProducts().length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.slug)}
              className={`px-4 py-2 rounded text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-[#C9A961] text-[#0F1113]'
                  : 'bg-[#171A1F] text-[#9CA3AF] hover:text-[#F5F5F5] border border-[#242831]'
              }`}
            >
              {cat.name} ({cat.itemCount})
            </button>
          ))}
        </div>

        {/* Search, Price & Sort Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-lg bg-[#171A1F] border border-[#242831]">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t.shop.searchPlaceholder}
              className="w-full bg-[#121418] border border-[#242831] text-xs text-[#F5F5F5] pl-9 pr-8 rtl:pl-8 rtl:pr-9 py-2 rounded outline-none focus:border-[#C9A961] placeholder:text-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rtl:right-auto rtl:left-2.5 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Price Inputs */}
            <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
              <span>{language === 'ar' ? 'السعر ($):' : 'Price ($):'}</span>
              <input
                type="number"
                placeholder={language === 'ar' ? 'الأدنى' : 'Min'}
                value={minPrice ?? ''}
                onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                className="w-16 bg-[#121418] border border-[#242831] text-xs text-[#F5F5F5] px-2 py-1.5 rounded outline-none focus:border-[#C9A961]"
              />
              <span>—</span>
              <input
                type="number"
                placeholder={language === 'ar' ? 'الأعلى' : 'Max'}
                value={maxPrice ?? ''}
                onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                className="w-16 bg-[#121418] border border-[#242831] text-xs text-[#F5F5F5] px-2 py-1.5 rounded outline-none focus:border-[#C9A961]"
              />
            </div>

            {/* In Stock Toggle */}
            <button
              onClick={() => setInStockOnly(!inStockOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors cursor-pointer ${
                inStockOnly
                  ? 'border-[#C9A961] bg-[#C9A961]/10 text-[#C9A961]'
                  : 'border-[#242831] bg-[#121418] text-[#9CA3AF] hover:text-[#F5F5F5]'
              }`}
            >
              <div
                className={`w-3 h-3 rounded flex items-center justify-center border ${
                  inStockOnly ? 'bg-[#C9A961] border-[#C9A961]' : 'border-[#9CA3AF]'
                }`}
              >
                {inStockOnly && <Check className="w-2.5 h-2.5 text-[#0F1113]" />}
              </div>
              <span>{language === 'ar' ? 'المتوفر فقط' : 'In Stock'}</span>
            </button>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 text-xs bg-[#121418] border border-[#242831] rounded px-3 py-1.5 text-[#9CA3AF]">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#C9A961]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-[#F5F5F5] outline-none text-xs cursor-pointer"
              >
                <option value="newest" className="bg-[#171A1F]">{t.shop.sortNewest}</option>
                <option value="price-asc" className="bg-[#171A1F]">{t.shop.sortPriceAsc}</option>
                <option value="price-desc" className="bg-[#171A1F]">{t.shop.sortPriceDesc}</option>
                <option value="popular" className="bg-[#171A1F]">{t.shop.sortPopular}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid Component */}
      <ProductGrid
        products={paginatedProducts}
        onResetFilters={handleClearFilters}
        emptyTitle={t.shop.emptyTitle}
        emptyDescription={t.shop.emptyDescription}
      />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pt-8 border-t border-[#242831] flex items-center justify-between text-xs text-[#9CA3AF]">
          <div>
            {language === 'ar'
              ? `عرض ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredProducts.length)} من أصل ${filteredProducts.length} قطعة`
              : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredProducts.length)} of ${filteredProducts.length} artifacts`}
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
                      ? 'bg-[#C9A961] text-[#0F1113] font-bold'
                      : 'bg-[#171A1F] border border-[#242831] text-[#F5F5F5] hover:border-[#C9A961]'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
