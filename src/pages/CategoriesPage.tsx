import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { fetchCategories } from '../lib/api';
import { ArrowRight, Loader2, AlertTriangle } from 'lucide-react';

export const CategoriesPage: React.FC = () => {
  const { navigate, setSelectedCategory } = useStore();
  const { t, language, localizeCategory } = useTranslation();
  const [raw, setRaw] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    setRaw(null);
    try {
      const cats = await fetchCategories();
      setRaw(cats.map((c) => ({ ...c, imageUrl: c.image_url, itemCount: c.item_count })));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.categories.errorLoading);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const categories = (raw ?? []).map(localizeCategory);

  const handleSelect = (slug: string) => {
    setSelectedCategory(slug);
    navigate('shop');
  };

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center px-6">
        <AlertTriangle className="h-10 w-10 text-[#C9A961]" aria-hidden />
        <h1 className="font-serif-luxury text-2xl text-[#F5F5F5]">{t.categories.errorLoading}</h1>
        <p className="max-w-md text-sm text-[#9CA3AF]">{error}</p>
        <button onClick={load} className="rounded-md bg-[#C9A961] px-5 py-2 text-sm font-medium text-[#0F1113] hover:bg-[#E7D3A0]">
          {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
        </button>
      </div>
    );
  }

  if (!raw) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
        <Loader2 className="h-8 w-8 animate-spin text-[#C9A961]" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="max-w-3xl space-y-3">
        <span className="text-xs uppercase tracking-[0.2em] text-[#C9A961] font-semibold">
          {language === 'ar' ? 'بيوت الحرفة والتخصصات المعمارية' : 'Artisanal Guilds & Domains'}
        </span>
        <h1 className="font-serif-luxury text-3xl sm:text-5xl font-bold text-[#F5F5F5]">
          {t.categories.title}
        </h1>
        <p className="text-sm text-[#9CA3AF] leading-relaxed">
          {t.categories.subtitle}
        </p>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            onClick={() => handleSelect(cat.slug)}
            className="group relative rounded-xl overflow-hidden bg-[#171A1F] border border-[#242831] hover:border-[#C9A961]/50 transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#121418]">
              <img
                src={cat.imageUrl}
                alt={cat.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171A1F] via-[#171A1F]/30 to-transparent" />
              <div className="absolute top-4 left-4 rtl:left-auto rtl:right-4 font-mono text-[11px] text-[#E7D3A0] bg-black/60 px-2.5 py-1 rounded backdrop-blur-md">
                {language === 'ar' ? `القسم 0${idx + 1}` : `ATELIER 0${idx + 1}`}
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif-luxury text-2xl font-bold text-[#F5F5F5] group-hover:text-[#C9A961] transition-colors">
                  {cat.name}
                </h3>
                <span className="text-xs font-mono text-[#C9A961]">
                  {cat.itemCount} {t.categories.artifactsCount}
                </span>
              </div>

              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                {cat.description}
              </p>

              <div className="pt-2 flex items-center gap-1.5 text-xs font-semibold text-[#F5F5F5] group-hover:text-[#C9A961] transition-colors">
                <span>{t.categories.exploreAtelier}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
