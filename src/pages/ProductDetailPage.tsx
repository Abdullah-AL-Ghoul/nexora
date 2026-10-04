import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { db } from '../lib/db';
import { ProductVariant } from '../types';
import { ProductCard } from '../components/store/ProductCard';
import {
  Shield,
  Truck,
  Heart,
  Plus,
  Minus,
  Check,
  Award,
  ArrowLeft,
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { routeParams, navigate, addToCart, toggleWishlist, isInWishlist } = useStore();
  const { t, language, getCategoryName } = useTranslation();
  const slug = routeParams.slug;
  const product = db.getProductBySlug(slug || '');

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="font-serif-luxury text-2xl font-bold text-[#F5F5F5]">{t.product.notFoundTitle}</h2>
        <p className="text-xs text-[#9CA3AF]">
          {t.product.notFoundDesc}
        </p>
        <button
          onClick={() => navigate('shop')}
          className="px-6 py-2.5 rounded bg-[#C9A961] text-[#0F1113] font-semibold text-xs uppercase cursor-pointer"
        >
          {t.product.returnCollection}
        </button>
      </div>
    );
  }

  const currentVariant = selectedVariant || (product.variants.length > 0 ? product.variants[0] : undefined);
  const currentPrice = currentVariant ? currentVariant.price : product.price;
  const currentStock = currentVariant ? currentVariant.stock : product.stock;
  const isWishlisted = isInWishlist(product.id);
  const relatedProducts = db.getRelatedProducts(product, 4);

  const handleAddToCart = () => {
    addToCart(product, quantity, currentVariant);
  };

  const localizedCategoryName = getCategoryName(product.categoryId, product.categoryName);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      {/* Back button */}
      <button
        onClick={() => navigate('shop')}
        className="inline-flex items-center gap-2 text-xs text-[#9CA3AF] hover:text-[#C9A961] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
        <span>{t.product.returnCatalog}</span>
      </button>

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left: Gallery (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Primary Image */}
          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#171A1F] border border-[#242831]">
            <img
              src={product.images[activeImageIndex]?.url || product.images[0]?.url}
              alt={product.images[activeImageIndex]?.altText || product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border transition-all cursor-pointer shrink-0 ${
                    activeImageIndex === idx
                      ? 'border-[#C9A961] ring-1 ring-[#C9A961]'
                      : 'border-[#242831] opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt={img.altText} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Purchasing & Details Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Metadata line */}
          <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
            <span className="uppercase tracking-widest text-[#C9A961] font-semibold text-[11px]">
              {localizedCategoryName}
            </span>
            <span>·</span>
            <span className="font-mono text-[11px] text-[#9CA3AF]">{product.sku}</span>
          </div>

          <h1 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-[#F5F5F5] leading-tight">
            {product.name}
          </h1>

          <p className="text-sm text-[#C9A961] font-medium leading-relaxed">
            {product.tagline}
          </p>

          <p className="text-xs text-[#9CA3AF] leading-relaxed">
            {product.description}
          </p>

          {/* Price display */}
          <div className="py-4 border-y border-[#242831] flex items-baseline gap-4">
            <span className="text-3xl font-bold text-[#F5F5F5] font-mono">
              ${currentPrice.toLocaleString()}
            </span>
            {product.compareAtPrice && product.compareAtPrice > currentPrice && (
              <span className="text-sm text-[#9CA3AF] line-through font-mono">
                ${product.compareAtPrice.toLocaleString()}
              </span>
            )}
            <span className="text-xs text-emerald-400 font-mono ml-auto rtl:ml-0 rtl:mr-auto">
              {currentStock > 0
                ? `${t.product.inStock} (${currentStock} ${language === 'ar' ? 'قطعة' : 'units'})`
                : t.product.outOfStock}
            </span>
          </div>

          {/* Variants Selector */}
          {product.variants.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider block">
                {t.product.selectVariant}
              </label>
              <div className="grid grid-cols-1 gap-2">
                {product.variants.map((v) => {
                  const isSelected = currentVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`flex items-center justify-between p-3 rounded-md text-xs border text-left rtl:text-right transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#C9A961] bg-[#C9A961]/10 text-[#F5F5F5]'
                          : 'border-[#242831] bg-[#171A1F] text-[#9CA3AF] hover:border-[#9CA3AF]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && <Check className="w-4 h-4 text-[#C9A961]" />}
                        <span className="font-medium text-[#F5F5F5]">{v.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#9CA3AF]">
                          {language === 'ar' ? `المخزون: ${v.stock}` : `Stock: ${v.stock}`}
                        </span>
                        <span className="font-mono font-semibold text-[#F5F5F5]">
                          ${v.price.toLocaleString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity and Actions */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-4">
              {/* Quantity selector */}
              <div className="flex items-center border border-[#242831] rounded-md bg-[#171A1F]">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 text-[#9CA3AF] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-12 text-center text-xs font-mono font-bold text-[#F5F5F5]">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                  className="p-3 text-[#9CA3AF] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Cart button */}
              <button
                onClick={handleAddToCart}
                disabled={currentStock <= 0}
                className="flex-1 py-3.5 px-6 rounded-md bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] font-semibold text-xs tracking-[0.15em] uppercase flex items-center justify-center gap-2 shadow-xl shadow-[#C9A961]/10 transition-colors cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                <span>{currentStock > 0 ? t.product.addToBag : t.product.outOfStock}</span>
              </button>

              {/* Wishlist button */}
              <button
                onClick={() => toggleWishlist(product)}
                className={`p-3.5 rounded-md border transition-colors cursor-pointer ${
                  isWishlisted
                    ? 'border-[#C9A961] bg-[#C9A961] text-[#0F1113]'
                    : 'border-[#242831] bg-[#171A1F] text-[#9CA3AF] hover:text-[#F5F5F5] hover:border-[#C9A961]'
                }`}
                aria-label="Toggle Wishlist"
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Value Guarantees */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#242831] text-[11px] text-[#9CA3AF]">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#C9A961]" />
                <span>{t.product.insuredFreight}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#C9A961]" />
                <span>{t.product.warranty}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#C9A961]" />
                <span>{t.product.certifiedOrigin}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Specifications Section */}
      <section className="border-t border-[#242831] pt-12">
        <h3 className="font-serif-luxury text-xl font-bold text-[#F5F5F5] mb-6">
          {t.product.specsTitle}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#171A1F] border border-[#242831] rounded-xl p-6 sm:p-8">
          <div className="divide-y divide-[#242831] text-xs">
            <div className="py-3 flex justify-between">
              <span className="text-[#9CA3AF]">{t.product.placeOfOrigin}</span>
              <span className="text-[#F5F5F5] font-medium">{product.origin || (language === 'ar' ? 'جنيف، سويسرا' : 'Geneva, Switzerland')}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[#9CA3AF]">{t.product.atelierDiscipline}</span>
              <span className="text-[#F5F5F5] font-medium">{localizedCategoryName}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[#9CA3AF]">{t.product.skuLabel}</span>
              <span className="font-mono text-[#F5F5F5]">{product.sku}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[#9CA3AF]">{t.product.dimensions}</span>
              <span className="text-[#F5F5F5] font-medium">{product.dimensions || (language === 'ar' ? 'مقاييس معمارية دقيقة' : 'Bespoke hand-crafted scale')}</span>
            </div>
          </div>

          <div className="divide-y divide-[#242831] text-xs">
            <div className="py-3 flex justify-between">
              <span className="text-[#9CA3AF]">{t.product.weight}</span>
              <span className="text-[#F5F5F5] font-medium">{product.weight || (language === 'ar' ? 'وزن متوازن ومدروس' : 'Calibrated balanced heft')}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[#9CA3AF]">{t.product.materials}</span>
              <span className="text-[#F5F5F5] font-medium">
                {product.materials?.join(', ') || (language === 'ar' ? 'سبائك طيران صلبة، زجاج سافير مزدوج' : 'Aerospace Alloys, Sapphire Crystal')}
              </span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[#9CA3AF]">{t.product.qualityStandard}</span>
              <span className="text-[#F5F5F5] font-medium">{language === 'ar' ? 'معيار ISO 9001 / دقة كرونومترية' : 'ISO 9001 / Chronometric Grade'}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-[#9CA3AF]">{t.product.serialVerification}</span>
              <span className="text-[#C9A961] font-mono">{language === 'ar' ? 'رقم تسلسلي محفور بالليزر' : 'Laser-Etched Holographic Tag'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Related Products Carousel */}
      {relatedProducts.length > 0 && (
        <section className="border-t border-[#242831] pt-12 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-luxury text-xl font-bold text-[#F5F5F5]">
              {t.product.relatedTitle}
            </h3>
            <button
              onClick={() => {
                navigate('shop');
              }}
              className="text-xs text-[#C9A961] hover:underline cursor-pointer"
            >
              {t.home.exploreFullCatalog}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
