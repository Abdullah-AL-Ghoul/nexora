import React from 'react';
import { Product } from '../../types';
import { useStore } from '../../store/useStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Heart, Eye, Plus } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { navigate, addToCart, toggleWishlist, isInWishlist, setQuickViewProduct } = useStore();
  const { t, language, getCategoryName } = useTranslation();

  const primaryImage = (product.images && product.images.length > 0)
    ? (product.images.find((i) => i.isPrimary) || product.images[0])
    : undefined;
  const isWishlisted = isInWishlist(product.id);
  const localizedCatName = getCategoryName(product.categoryId, product.categoryName);

  const handleCardClick = () => {
    navigate('product', { slug: product.slug });
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If product has variants, open quick view to let user choose variant
    if (product.variants && product.variants.length > 0) {
      setQuickViewProduct(product);
    } else {
      addToCart(product, 1);
    }
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickViewProduct(product);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex flex-col bg-surface border border-line hover:border-gold/40 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer"
    >
      {/* Product Image Stage */}
      <div className="relative aspect-square w-full overflow-hidden bg-raised flex items-center justify-center">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={primaryImage.altText || product.name}
            loading="lazy"
            className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="font-serif-luxury text-sm text-fg-muted">{product.name}</span>
        )}

        {/* Hover Quick Action Layer */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3 gap-2 backdrop-blur-[2px]">
          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickView}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-surface/95 hover:bg-line text-fg hover:text-gold border border-line shadow-xl text-xs font-medium tracking-wide transition-all cursor-pointer transform translate-y-2 group-hover:translate-y-0 duration-300"
              aria-label="Quick View"
            >
              <Eye className="w-3.5 h-3.5 text-gold" />
              <span>{t.shop.quickView}</span>
            </button>

            <button
              onClick={handleQuickAdd}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-gold hover:bg-gold-soft text-ink font-semibold text-xs tracking-wide shadow-xl transition-all cursor-pointer transform translate-y-2 group-hover:translate-y-0 duration-300 delay-75"
              aria-label="Add Artifact to Shopping Bag"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{product.variants.length > 0 ? (language === 'ar' ? 'اختر' : 'Select') : t.shop.addToCart}</span>
            </button>
          </div>
        </div>

        {/* Wishlist Button */}
        <button
          onClick={handleWishlistToggle}
          className={`absolute top-3 right-3 rtl:right-auto rtl:left-3 p-2 rounded-full backdrop-blur-md transition-colors cursor-pointer ${
            isWishlisted
              ? 'bg-gold text-ink'
              : 'bg-surface/80 text-fg hover:text-gold border border-line'
          }`}
          aria-label={isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
        >
          <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>

        {/* Quiet Low Stock Indicator */}
        {product.stock <= 5 && product.stock > 0 && (
          <div className="absolute bottom-3 left-3 rtl:left-auto rtl:right-3 text-[10px] tracking-wider uppercase text-amber-300/90 font-mono bg-black/60 px-2 py-0.5 rounded">
            {t.shop.onlyLeft} {product.stock}
          </div>
        )}
      </div>

      {/* Product Content Details */}
      <div className="flex flex-1 flex-col p-4">
        {/* Anti-Slop: Quiet unboxed metadata with typographic dot separator */}
        <div className="flex items-center gap-2 text-xs text-fg-muted mb-1.5">
          <span className="uppercase tracking-wider text-[11px] text-gold/80 font-medium">
            {localizedCatName}
          </span>
          <span aria-hidden="true" className="text-fg-faint">·</span>
          <span className="font-mono text-[10px] text-fg-muted">{product.sku}</span>
        </div>

        {/* Product Title */}
        <h3 className="font-medium text-sm text-fg group-hover:text-gold transition-colors line-clamp-1">
          {product.name}
        </h3>

        {/* Quiet 1-line Tagline */}
        <p className="text-xs text-fg-muted mt-1 line-clamp-1 leading-relaxed">
          {product.tagline}
        </p>

        {/* Price & Variants line */}
        <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-fg">
              ${product.price.toLocaleString()}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-xs text-fg-muted line-through">
                ${product.compareAtPrice.toLocaleString()}
              </span>
            )}
          </div>

          {product.variants.length > 0 && (
            <span className="text-[11px] text-fg-muted">
              {product.variants.length} {t.shop.options}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
