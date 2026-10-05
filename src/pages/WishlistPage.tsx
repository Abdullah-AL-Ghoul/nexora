import React from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { ProductCard } from '../components/store/ProductCard';
import { Heart } from 'lucide-react';

export const WishlistPage: React.FC = () => {
  const { wishlist, navigate } = useStore();
  const { t, language } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-line pb-6 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
            {language === 'ar' ? 'السجل الخاص' : 'Private Archive'}
          </span>
          <h1 className="font-serif-luxury text-3xl font-bold text-fg mt-1">
            {t.wishlist.title} ({wishlist.length})
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            {t.wishlist.subtitle}
          </p>
        </div>
      </div>

      {wishlist.length === 0 ? (
        <div className="p-16 text-center rounded-xl bg-surface border border-line space-y-4">
          <div className="w-16 h-16 rounded-full bg-raised border border-line flex items-center justify-center mx-auto text-fg-muted">
            <Heart className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-fg">{t.wishlist.emptyTitle}</h3>
          <p className="text-xs text-fg-muted max-w-sm mx-auto">
            {t.wishlist.emptySubtitle}
          </p>
          <button
            onClick={() => navigate('shop')}
            className="px-6 py-2.5 rounded bg-gold text-ink hover:bg-gold-soft text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {t.wishlist.browseCatalog}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {wishlist.map((item) => (
            <ProductCard key={item.id} product={item.product} />
          ))}
        </div>
      )}
    </div>
  );
};
