import React from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { ArrowRight } from 'lucide-react';

export const AboutPage: React.FC = () => {
  const { navigate } = useStore();
  const { t, language } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
          {language === 'ar' ? 'بيان نكسورا المعماري' : 'Architectural Manifesto'}
        </span>
        <h1 className="font-serif-luxury text-4xl sm:text-5xl font-bold text-fg leading-tight">
          {t.about.title}
        </h1>
        <p className="text-sm text-fg-muted leading-relaxed font-light">
          {t.about.subtitle}
        </p>
      </div>

      {/* Hero Image */}
      <div className="relative aspect-[21/9] rounded-2xl overflow-hidden border border-line">
        <img
          src="/img/nx-1522335789203-aabd1fc54bc9.jpg"
          alt="Horology atelier workbench"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1113] via-transparent to-transparent" />
      </div>

      {/* Three Tenets */}
      <div className="space-y-12">
        <div className="space-y-3">
          <h2 className="font-serif-luxury text-2xl font-bold text-fg">
            {t.about.pillar1Title}
          </h2>
          <p className="text-xs sm:text-sm text-fg-muted leading-relaxed">
            {t.about.pillar1Text}
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-serif-luxury text-2xl font-bold text-fg">
            {t.about.pillar2Title}
          </h2>
          <p className="text-xs sm:text-sm text-fg-muted leading-relaxed">
            {t.about.pillar2Text}
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-serif-luxury text-2xl font-bold text-fg">
            {t.about.pillar3Title}
          </h2>
          <p className="text-xs sm:text-sm text-fg-muted leading-relaxed">
            {t.about.pillar3Text}
          </p>
        </div>
      </div>

      {/* CTA Box */}
      <div className="p-8 rounded-xl bg-surface border border-line text-center space-y-4">
        <h3 className="font-serif-luxury text-xl font-bold text-fg">
          {language === 'ar' ? 'تصفح التشكيلة الكاملة' : 'Inspect the Collection'}
        </h3>
        <p className="text-xs text-fg-muted max-w-md mx-auto">
          {language === 'ar'
            ? 'استكشف بيوت الحرفة الثمانية المتخصصة في الساعات السويسرية، الشاشات الصوتية، ومساحات العمل المعمارية.'
            : 'Explore our eight ateliers spanning Swiss horology, acoustic monitors, and workspace architecture.'}
        </p>
        <button
          onClick={() => navigate('shop')}
          className="px-8 py-3 rounded bg-gold text-ink hover:bg-gold-soft font-semibold text-xs tracking-wider uppercase inline-flex items-center gap-2 cursor-pointer transition-colors"
        >
          <span>{t.about.exploreWorks}</span>
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
};
