import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { fetchProductBySlug, fetchRelatedProducts, fetchReviews, submitReview, ApiProduct, Review } from '../lib/api';
import { setMeta } from '../lib/seo';
import { Product, ProductVariant } from '../types';
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
  Loader2,
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { navigate, addToCart, toggleWishlist, isInWishlist } = useStore();
  const { t, language, getCategoryName } = useTranslation();
  // Read the slug from the URL directly (react-router); fall back to the store
  // routeParams only if the param is absent (legacy deep-link path).
  const urlSlug = useParams<{ slug: string }>().slug;
  const routeParamsSlug = useStore((s) => s.routeParams.slug);
  const slug = urlSlug || routeParamsSlug;

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '', userName: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const requestIdRef = useRef(0);

  const loadReviews = (slugToLoad: string | undefined) => {
    if (!slugToLoad) {
      setReviews([]);
      setReviewsLoading(false);
      return;
    }
    setReviewsLoading(true);
    fetchReviews(slugToLoad)
      .then((r) => setReviews(r))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  };

  const loadProduct = (slugToLoad: string | undefined) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    setProduct(null);
    setRelatedProducts([]);
    setActiveImageIndex(0);
    setSelectedVariant(undefined);
    setQuantity(1);

    if (!slugToLoad) {
      setLoading(false);
      return;
    }

    fetchProductBySlug(slugToLoad)
      .then((data: ApiProduct) => {
        if (requestIdRef.current !== requestId) return;
        setProduct(data as Product);
        // Per-product SEO: rich title + structured data (Product schema)
        setMeta({
          title: `${data.name} | NEXORA`,
          description: data.tagline || data.description?.slice(0, 160),
          canonical: `${window.location.origin}/product/${data.slug}`,
          jsonLd: [{
            key: 'product',
            data: {
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: data.name,
              description: data.tagline || data.description,
              image: data.images?.map((i) => i.url) ?? [],
              sku: data.sku,
              brand: { '@type': 'Brand', name: 'NEXORA' },
              offers: {
                '@type': 'Offer',
                price: data.price,
                priceCurrency: 'USD',
                availability: data.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              },
              aggregateRating: data.reviewsCount > 0
                ? { '@type': 'AggregateRating', ratingValue: data.rating, reviewCount: data.reviewsCount }
                : undefined,
            },
          }],
        });
        return fetchRelatedProducts(data.slug).then((related: ApiProduct[]) => {
          if (requestIdRef.current !== requestId) return;
          setRelatedProducts(related as Product[]);
        });
      })
      .catch((e) => {
        if (requestIdRef.current !== requestId) return;
        setLoadError(e instanceof Error ? e.message : 'Unable to load product');
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  };

  useEffect(() => {
    loadProduct(slug);
    loadReviews(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="font-serif-luxury text-2xl font-bold text-fg">{t.product.notFoundTitle}</h2>
        <p className="text-xs text-fg-muted">
          {loadError}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => loadProduct(slug)}
            className="px-6 py-2.5 rounded bg-gold text-ink font-semibold text-xs uppercase cursor-pointer"
          >
            {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
          </button>
          <button
            onClick={() => navigate('shop')}
            className="px-6 py-2.5 rounded bg-surface border border-line text-fg font-semibold text-xs uppercase cursor-pointer"
          >
            {t.product.returnCollection}
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="font-serif-luxury text-2xl font-bold text-fg">{t.product.notFoundTitle}</h2>
        <p className="text-xs text-fg-muted">
          {t.product.notFoundDesc}
        </p>
        <button
          onClick={() => navigate('shop')}
          className="px-6 py-2.5 rounded bg-gold text-ink font-semibold text-xs uppercase cursor-pointer"
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

  const handleAddToCart = () => {
    addToCart(product, quantity, currentVariant);
  };

  const localizedCategoryName = getCategoryName(product.categoryId, product.categoryName);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      {/* Back button */}
      <button
        onClick={() => navigate('shop')}
        className="inline-flex items-center gap-2 text-xs text-fg-muted hover:text-gold transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
        <span>{t.product.returnCatalog}</span>
      </button>

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left: Gallery (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Primary Image */}
          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-surface border border-line">
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
                      ? 'border-gold ring-1 ring-gold'
                      : 'border-line opacity-70 hover:opacity-100'
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
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <span className="uppercase tracking-widest text-gold font-semibold text-[11px]">
              {localizedCategoryName}
            </span>
            <span>·</span>
            <span className="font-mono text-[11px] text-fg-muted">{product.sku}</span>
          </div>

          <h1 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-fg leading-tight">
            {product.name}
          </h1>

          <p className="text-sm text-gold font-medium leading-relaxed">
            {product.tagline}
          </p>

          <p className="text-xs text-fg-muted leading-relaxed">
            {product.description}
          </p>

          {/* Price display */}
          <div className="py-4 border-y border-line flex items-baseline gap-4">
            <span className="text-3xl font-bold text-fg font-mono">
              ${currentPrice.toLocaleString()}
            </span>
            {product.compareAtPrice && product.compareAtPrice > currentPrice && (
              <span className="text-sm text-fg-muted line-through font-mono">
                ${product.compareAtPrice.toLocaleString()}
              </span>
            )}
            <span className="text-xs text-success font-mono ml-auto rtl:ml-0 rtl:mr-auto">
              {currentStock > 0
                ? `${t.product.inStock} (${currentStock} ${language === 'ar' ? 'قطعة' : 'units'})`
                : t.product.outOfStock}
            </span>
          </div>

          {/* Variants Selector */}
          {product.variants.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-fg uppercase tracking-wider block">
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
                          ? 'border-gold bg-gold/10 text-fg'
                          : 'border-line bg-surface text-fg-muted hover:border-fg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && <Check className="w-4 h-4 text-gold" />}
                        <span className="font-medium text-fg">{v.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-fg-muted">
                          {language === 'ar' ? `المخزون: ${v.stock}` : `Stock: ${v.stock}`}
                        </span>
                        <span className="font-mono font-semibold text-fg">
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
              <div className="flex items-center border border-line rounded-md bg-surface">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 text-fg-muted hover:text-fg transition-colors cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-12 text-center text-xs font-mono font-bold text-fg">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                  className="p-3 text-fg-muted hover:text-fg transition-colors cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Cart button */}
              <button
                onClick={handleAddToCart}
                disabled={currentStock <= 0}
                className="flex-1 py-3.5 px-6 rounded-md bg-gold text-ink hover:bg-gold-soft font-semibold text-xs tracking-[0.15em] uppercase flex items-center justify-center gap-2 shadow-xl shadow-gold/10 transition-colors cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                <span>{currentStock > 0 ? t.product.addToBag : t.product.outOfStock}</span>
              </button>

              {/* Wishlist button */}
              <button
                onClick={() => toggleWishlist(product)}
                className={`p-3.5 rounded-md border transition-colors cursor-pointer ${
                  isWishlisted
                    ? 'border-gold bg-gold text-ink'
                    : 'border-line bg-surface text-fg-muted hover:text-fg hover:border-gold'
                }`}
                aria-label="Toggle Wishlist"
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Value Guarantees */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-line text-[11px] text-fg-muted">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-gold" />
                <span>{t.product.insuredFreight}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-gold" />
                <span>{t.product.warranty}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-gold" />
                <span>{t.product.certifiedOrigin}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Specifications Section */}
      <section className="border-t border-line pt-12">
        <h3 className="font-serif-luxury text-xl font-bold text-fg mb-6">
          {t.product.specsTitle}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-surface border border-line rounded-xl p-6 sm:p-8">
          <div className="divide-y divide-[#242831] text-xs">
            <div className="py-3 flex justify-between">
              <span className="text-fg-muted">{t.product.placeOfOrigin}</span>
              <span className="text-fg font-medium">{product.origin || (language === 'ar' ? 'جنيف، سويسرا' : 'Geneva, Switzerland')}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-fg-muted">{t.product.atelierDiscipline}</span>
              <span className="text-fg font-medium">{localizedCategoryName}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-fg-muted">{t.product.skuLabel}</span>
              <span className="font-mono text-fg">{product.sku}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-fg-muted">{t.product.dimensions}</span>
              <span className="text-fg font-medium">{product.dimensions || (language === 'ar' ? 'مقاييس معمارية دقيقة' : 'Bespoke hand-crafted scale')}</span>
            </div>
          </div>

          <div className="divide-y divide-[#242831] text-xs">
            <div className="py-3 flex justify-between">
              <span className="text-fg-muted">{t.product.weight}</span>
              <span className="text-fg font-medium">{product.weight || (language === 'ar' ? 'وزن متوازن ومدروس' : 'Calibrated balanced heft')}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-fg-muted">{t.product.materials}</span>
              <span className="text-fg font-medium">
                {product.materials?.join(', ') || (language === 'ar' ? 'سبائك طيران صلبة، زجاج سافير مزدوج' : 'Aerospace Alloys, Sapphire Crystal')}
              </span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-fg-muted">{t.product.qualityStandard}</span>
              <span className="text-fg font-medium">{language === 'ar' ? 'معيار ISO 9001 / دقة كرونومترية' : 'ISO 9001 / Chronometric Grade'}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-fg-muted">{t.product.serialVerification}</span>
              <span className="text-gold font-mono">{language === 'ar' ? 'رقم تسلسلي محفور بالليزر' : 'Laser-Etched Holographic Tag'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews — real, server-backed */}
      <section className="border-t border-line pt-12 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-serif-luxury text-xl font-bold text-fg">
            {language === 'ar' ? 'آراء المقتنين' : 'Collector Reviews'}
            <span className="ml-2 align-middle text-xs font-sans font-normal text-fg-muted">
              ({product.reviewsCount ?? reviews.length})
            </span>
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-serif-luxury text-2xl font-semibold text-gold">
              {Number(product.rating ?? 0).toFixed(1)}
            </span>
            <span className="text-fg-muted text-xs">
              <span className="block text-gold" aria-hidden>
                {'★'.repeat(Math.round(product.rating ?? 0))}{'☆'.repeat(5 - Math.round(product.rating ?? 0))}
              </span>
              {language === 'ar' ? 'متوسط التقييم' : 'average rating'}
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Review form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (reviewSubmitting) return;
              if (!reviewForm.title.trim() || !reviewForm.comment.trim()) {
                return;
              }
              setReviewSubmitting(true);
              try {
                const r = await submitReview(slug!, {
                  rating: reviewForm.rating,
                  title: reviewForm.title.trim(),
                  comment: reviewForm.comment.trim(),
                  userName: reviewForm.userName.trim() || undefined,
                });
                setReviews((prev) => [r, ...prev]);
                setReviewForm({ rating: 5, title: '', comment: '', userName: '' });
              } catch (err: any) {
                alert(err?.message || 'Unable to submit review');
              } finally {
                setReviewSubmitting(false);
              }
            }}
            className="lg:col-span-2 rounded-xl border border-line bg-surface p-6 space-y-4 h-fit"
          >
            <h4 className="text-sm font-semibold text-fg">
              {language === 'ar' ? 'شارك تجربتك' : 'Share your experience'}
            </h4>
            <div>
              <label className="block text-xs text-fg-muted mb-1.5">{language === 'ar' ? 'التقييم' : 'Rating'}</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                    aria-label={`${n} stars`}
                    className={`text-2xl leading-none transition-colors ${n <= reviewForm.rating ? 'text-gold' : 'text-fg-faint'} cursor-pointer`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1.5">{language === 'ar' ? 'العنوان' : 'Title'}</label>
              <input
                value={reviewForm.title}
                onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={language === 'ar' ? 'عنوان مختصر لرأييك' : 'Short headline for your review'}
                className="w-full bg-raised border border-line text-fg px-3 py-2.5 rounded-lg outline-none focus:border-gold text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1.5">{language === 'ar' ? 'الرأي' : 'Comment'}</label>
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                rows={3}
                placeholder={language === 'ar' ? 'صف جودة القطعة وتجربتك معها...' : 'Describe the quality and your experience...'}
                className="w-full bg-raised border border-line text-fg px-3 py-2.5 rounded-lg outline-none focus:border-gold text-xs resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1.5">
                {language === 'ar' ? 'الاسم (اختياري)' : 'Name (optional)'}
              </label>
              <input
                value={reviewForm.userName}
                onChange={(e) => setReviewForm((f) => ({ ...f, userName: e.target.value }))}
                placeholder={language === 'ar' ? 'اسمك' : 'Your name'}
                className="w-full bg-raised border border-line text-fg px-3 py-2.5 rounded-lg outline-none focus:border-gold text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={reviewSubmitting}
              className="w-full py-2.5 rounded-lg bg-gold text-ink hover:bg-gold-soft font-semibold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
            >
              {reviewSubmitting
                ? (language === 'ar' ? 'جارٍ الإرسال...' : 'Submitting...')
                : (language === 'ar' ? 'نشر الرأي' : 'Submit Review')}
            </button>
          </form>

          {/* Reviews list */}
          <div className="lg:col-span-3 space-y-4">
            {reviewsLoading && (
              <p className="text-xs text-fg-faint">{language === 'ar' ? 'جارٍ تحميل الآراء...' : 'Loading reviews...'}</p>
            )}
            {!reviewsLoading && reviews.length === 0 && (
              <p className="text-sm text-fg-muted border border-dashed border-line rounded-xl p-8 text-center">
                {language === 'ar' ? 'لا توجد آراء بعد — كن أول من يشارك.' : 'No reviews yet — be the first to share yours.'}
              </p>
            )}
            {reviews.map((rv) => (
              <div key={rv.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center text-gold text-xs font-bold">
                      {rv.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-fg">{rv.userName}</p>
                      {rv.isVerifiedPurchase && (
                        <p className="text-[10px] text-success flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {language === 'ar' ? 'شراء موثق' : 'Verified purchase'}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-gold text-xs font-mono">
                    {new Date(rv.createdAt).toLocaleDateString(language === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="text-gold text-sm mb-1" aria-label={`${rv.rating} stars`}>
                  {'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}
                </div>
                <p className="text-xs font-semibold text-fg">{rv.title}</p>
                <p className="text-xs text-fg-muted leading-relaxed mt-1">{rv.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related Products Carousel */}
      {relatedProducts.length > 0 && (
        <section className="border-t border-line pt-12 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-luxury text-xl font-bold text-fg">
              {t.product.relatedTitle}
            </h3>
            <button
              onClick={() => {
                navigate('shop');
              }}
              className="text-xs text-gold hover:underline cursor-pointer"
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

export default ProductDetailPage;
