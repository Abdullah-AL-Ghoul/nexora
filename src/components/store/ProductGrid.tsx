import React from 'react';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { SlidersHorizontal, PackageX, Sparkles } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onResetFilters?: () => void;
  className?: string;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  isLoading = false,
  emptyTitle = 'No Matching Artifacts Found',
  emptyDescription = 'Try adjusting your price threshold, atelier selection, or search query.',
  onResetFilters,
  className = '',
}) => {
  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg bg-[#171A1F] border border-[#242831] overflow-hidden animate-pulse flex flex-col"
          >
            <div className="aspect-square bg-[#121418]" />
            <div className="p-4 space-y-3">
              <div className="h-3 bg-[#242831] rounded w-1/3" />
              <div className="h-4 bg-[#242831] rounded w-3/4" />
              <div className="h-3 bg-[#242831] rounded w-full" />
              <div className="pt-3 border-t border-[#242831] flex justify-between">
                <div className="h-4 bg-[#242831] rounded w-1/4" />
                <div className="h-4 bg-[#242831] rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-20 text-center space-y-4 rounded-xl bg-[#171A1F] border border-[#242831] p-8 max-w-xl mx-auto my-8">
        <div className="w-14 h-14 rounded-full bg-[#121418] border border-[#242831] flex items-center justify-center mx-auto text-[#9CA3AF]">
          <PackageX className="w-7 h-7 opacity-60" />
        </div>
        <h3 className="font-serif-luxury text-lg font-bold text-[#F5F5F5]">{emptyTitle}</h3>
        <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto leading-relaxed">
          {emptyDescription}
        </p>
        {onResetFilters && (
          <button
            onClick={onResetFilters}
            className="px-6 py-2.5 rounded bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer"
          >
            Reset All Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-300 ${className}`}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};
