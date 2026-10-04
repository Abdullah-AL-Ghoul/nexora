import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useTranslation } from '../../i18n/useTranslation';
import { ProductVariant } from '../../types';
import { X, Plus, Check } from 'lucide-react';

export const QuickViewModal: React.FC = () => {
  const { quickViewProduct, setQuickViewProduct, addToCart, navigate } = useStore();
  const { t, language, getCategoryName } = useTranslation();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);

  if (!quickViewProduct) return null;

  const product = quickViewProduct;
  const currentVariant = selectedVariant || (product.variants.length > 0 ? product.variants[0] : undefined);
  const currentPrice = currentVariant ? currentVariant.price : product.price;
  const currentStock = currentVariant ? currentVariant.stock : product.stock;
  const localizedCatName = getCategoryName(product.categoryId, product.categoryName);

  const handleAdd = () => {
    addToCart(product, quantity, currentVariant);
    setQuickViewProduct(null);
  };

  const handleViewFullPage = () => {
    setQuickViewProduct(null);
    navigate('product', { slug: product.slug });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div
        onClick={() => setQuickViewProduct(null)}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
      />

      <div className="relative w-full max-w-3xl bg-[#171A1F] border border-[#242831] rounded-xl shadow-2xl overflow-hidden z-10 grid grid-cols-1 md:grid-cols-2 my-auto max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => setQuickViewProduct(null)}
          className="absolute top-4 right-4 rtl:right-auto rtl:left-4 z-20 p-2 text-[#9CA3AF] hover:text-[#F5F5F5] bg-[#121418]/80 rounded-full transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Product Media */}
        <div className="relative aspect-square md:aspect-auto h-full bg-[#121418] flex items-center justify-center p-4">
          <img
            src={product.images[0]?.url}
            alt={product.name}
            className="w-full h-full object-cover rounded-lg"
          />
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <span className="text-[#C9A961] uppercase tracking-wider font-semibold">
                {localizedCatName}
              </span>
              <span>·</span>
              <span className="font-mono text-[11px] text-[#9CA3AF]">{product.sku}</span>
            </div>

            <h3 className="font-serif-luxury text-xl font-bold text-[#F5F5F5] mt-1">
              {product.name}
            </h3>

            <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed line-clamp-2">
              {product.description}
            </p>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-xl font-semibold text-[#F5F5F5]">
                ${currentPrice.toLocaleString()}
              </span>
              {product.compareAtPrice && product.compareAtPrice > currentPrice && (
                <span className="text-sm text-[#9CA3AF] line-through">
                  ${product.compareAtPrice.toLocaleString()}
                </span>
              )}
            </div>

            {/* Variants Selector */}
            {product.variants.length > 0 && (
              <div className="mt-5 space-y-2">
                <label className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                  {t.product.selectVariant}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {product.variants.map((v) => {
                    const isSelected = currentVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`flex items-center justify-between p-2.5 rounded text-xs border text-left rtl:text-right transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-[#C9A961] bg-[#C9A961]/10 text-[#F5F5F5]'
                            : 'border-[#242831] bg-[#121418] text-[#9CA3AF] hover:border-[#9CA3AF]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#C9A961]" />}
                          <span>{v.name}</span>
                        </div>
                        <span className="font-mono text-[#F5F5F5]">${v.price.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-[#242831]">
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-[#242831] rounded bg-[#121418] px-2 py-1.5 text-xs">
                <span className="text-[#9CA3AF] mr-2 rtl:mr-0 rtl:ml-2">
                  {language === 'ar' ? 'الكمية' : 'Qty'}
                </span>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                  className="bg-transparent text-[#F5F5F5] outline-none cursor-pointer"
                >
                  {[...Array(Math.min(currentStock, 8))].map((_, idx) => (
                    <option key={idx + 1} value={idx + 1} className="bg-[#171A1F]">
                      {idx + 1}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAdd}
                disabled={currentStock <= 0}
                className="flex-1 py-2.5 px-4 rounded bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] font-semibold text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{currentStock > 0 ? t.product.addToBag : t.product.outOfStock}</span>
              </button>
            </div>

            <button
              onClick={handleViewFullPage}
              className="w-full text-center text-xs text-[#9CA3AF] hover:text-[#C9A961] transition-colors cursor-pointer"
            >
              {language === 'ar' ? 'عرض الصفحة الكاملة للمنتج والتفاصيل ←' : 'View Full Details & Provenance Page →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
