import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { useTranslation } from '../../i18n/useTranslation';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface Slide {
  id: string;
  categorySlug: string;
  atelierLabel: { ar: string; en: string };
  tagline: { ar: string; en: string };
  titleLine1: { ar: string; en: string };
  titleLine2: { ar: string; en: string };
  description: { ar: string; en: string };
  imageUrl: string;
  accentNote: { ar: string; en: string };
  priceNote: { ar: string; en: string };
}

const HERO_SLIDES: Slide[] = [
  {
    id: 'slide_tp',
    categorySlug: 'timepieces',
    atelierLabel: { ar: 'القسم الأول · الساعات الفاخرة', en: 'Atelier I · Haute Horology' },
    tagline: { ar: 'دقة سويسرية مطلقة', en: 'GENEVA CALIBER ARCHITECTURE' },
    titleLine1: { ar: 'نقاء ميكانيكي.', en: 'Mechanical Purity.' },
    titleLine2: { ar: 'إتقان كرونومتري فائق.', en: 'Obsidian Precision.' },
    description: {
      ar: 'كرونوغرافات سويسرية أوتوماتيكية باحتياطي طاقة 70 ساعة، مصنعة من صلب 316L فائق الصلابة مع زجاج سافير مزدوج مضاد للانعكاس.',
      en: 'Swiss automatic column-wheel chronographs with 70-hour power reserves. Encased in cold-rolled 316L aerospace steel with dual-curved anti-reflective sapphire crystals.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1800&q=85',
    accentNote: { ar: 'إصدار محدود بـ 50 قطعة سنوياً', en: 'Limited to 50 Annual Commissions' },
    priceNote: { ar: 'يبدأ من $890', en: 'Starting at $890' },
  },
  {
    id: 'slide_au',
    categorySlug: 'audio-engineering',
    atelierLabel: { ar: 'القسم الثاني · الهندسة الصوتية', en: 'Atelier II · Acoustic Science' },
    tagline: { ar: 'ديناميكا صوتية بنقاء البيريليوم', en: 'BERYLLIUM TRANSIENT DYNAMICS' },
    titleLine1: { ar: 'مغناطيسات بلانار.', en: 'Planar Magnetics.' },
    titleLine2: { ar: 'سكون ونقاء صوتي.', en: 'Acoustic Silence.' },
    description: {
      ar: 'شاشات استماع بلانار مغناطيسية خالية من التشويش، منحوتة من خشب الجوز الأمريكي الأسود والألومنيوم المصمت بدقة هندسية عالية.',
      en: 'Zero-distortion planar magnetic monitors sculpted from oiled American black walnut and CNC-milled aluminum billets. Uncolored fidelity calibrated to the human ear.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1800&q=85',
    accentNote: { ar: 'صنعت في كوبنهاغن', en: 'Machined In Copenhagen' },
    priceNote: { ar: 'من $380 إلى $3,400', en: 'From $380 to $3,400' },
  },
  {
    id: 'slide_le',
    categorySlug: 'minimalist-leather',
    atelierLabel: { ar: 'القسم الثالث · الجلود الفرنسية', en: 'Atelier III · Tuscan Leathercraft' },
    tagline: { ar: 'دباغة نباتية عضوية بطيئة', en: 'SLOW VEGETABLE TANNED HIDES' },
    titleLine1: { ar: 'جلود طبيعية.', en: 'Saddle Leather.' },
    titleLine2: { ar: 'جمال يزداد مع الزمن.', en: 'Enduring Patina.' },
    description: {
      ar: 'جلود أبقار فرنسية طبيعية مدبوغة بمستخلصات لحاء شجر الكستناء لمدة 60 يوماً ومخيطة يدوياً بحواف مصقولة بشمع العسل الطبيعي.',
      en: 'Hand-cut French cowhides slow-tanned in chestnut extracts for 60 days. Finished with beveled beeswax edges and solid cast brass Excella hardware.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=85',
    accentNote: { ar: 'عمر افتراضي متوارث', en: 'Heirloom Grade Longevity' },
    priceNote: { ar: 'حقائب ومحافظ مقتناة', en: 'Briefcases & Folios' },
  },
  {
    id: 'slide_ws',
    categorySlug: 'architectural-workspace',
    atelierLabel: { ar: 'القسم الرابع · هندسة مساحات العمل', en: 'Atelier IV · Desktop Architecture' },
    tagline: { ar: 'خشب الجوز الأمريكي الطبيعي', en: 'STRUCTURAL SOLID WALNUT' },
    titleLine1: { ar: 'سكون مكاني.', en: 'Spatial Calm.' },
    titleLine2: { ar: 'أناقة معمارية راسخة.', en: 'Milled Monoliths.' },
    description: {
      ar: 'حوامل مكتبية من خشب الجوز المجفف في الأفران، وإضاءات طيف شمسي 98-CRI مصممة لتوفير تركيز إبداعي عميق وهدوء حقيقي.',
      en: 'Kiln-dried continuous grain walnut desk risers, 98-CRI sunlight spectrum task illumination, and gasket-mounted billet aluminum keyboards designed for deep creative focus.',
    },
    imageUrl:
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1800&q=85',
    accentNote: { ar: 'تصميم ارغونومي مدروس', en: 'Precision Ergonomic Elevation' },
    priceNote: { ar: 'تجهيزات مكتبية راقية', en: 'Bespoke Studio Setup' },
  },
];

export const HeroSection: React.FC = () => {
  const { navigate, setSelectedCategory } = useStore();
  const { t, language } = useTranslation();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const slide = HERO_SLIDES[currentSlideIndex];

  // Auto-play timer
  useEffect(() => {
    if (isPaused) return;

    autoPlayRef.current = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 7000);

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isPaused]);

  const handlePrev = () => {
    setCurrentSlideIndex((prev) => (prev === 0 ? HERO_SLIDES.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  const handleExploreShop = () => {
    setSelectedCategory('all');
    navigate('shop');
  };

  const handleExploreAtelier = (categorySlug: string) => {
    setSelectedCategory(categorySlug);
    navigate('shop');
  };

  return (
    <section
      className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-ink border-b border-line"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Luxury Hero Showcase"
    >
      {/* 1. Imagery Slider Layer */}
      <div className="absolute inset-0 z-0">
        {HERO_SLIDES.map((item, index) => {
          const isActive = index === currentSlideIndex;
          return (
            <div
              key={item.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
              } transform transition-transform duration-[7000ms]`}
            >
              <img
                src={item.imageUrl}
                alt={item.titleLine1[language]}
                className="w-full h-full object-cover object-center filter brightness-[0.45] contrast-[1.12]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F1113] via-[#0F1113]/50 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0F1113]/90 via-[#0F1113]/40 to-transparent rtl:bg-gradient-to-l" />
            </div>
          );
        })}
      </div>

      {/* 2. Central Editorial Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="max-w-3xl space-y-6">
          {/* Atelier Badge */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface/90 border border-gold/40 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-gold font-semibold">
              {slide.atelierLabel[language]}
            </span>
            <span aria-hidden="true" className="text-gold/40">·</span>
            <span className="text-xs font-mono uppercase tracking-widest text-gold-soft/90">
              {slide.tagline[language]}
            </span>
          </div>

          {/* Refined Typography Hierarchy */}
          <div className="space-y-2">
            <h1 className="font-serif-luxury text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-fg leading-[1.08]">
              {slide.titleLine1[language]} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5F5F5] via-[#E7D3A0] to-[#C9A961]">
                {slide.titleLine2[language]}
              </span>
            </h1>
          </div>

          {/* Editorial Description */}
          <p className="text-sm sm:text-base text-fg-muted max-w-2xl leading-relaxed font-light">
            {slide.description[language]}
          </p>

          {/* Call-To-Action Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <button
              onClick={handleExploreShop}
              className="px-8 py-4 rounded-md bg-gold text-ink hover:bg-gold-soft font-semibold text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2.5 shadow-2xl shadow-gold transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5"
            >
              <span>{t.hero.ctaExplore}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>

            <button
              onClick={() => handleExploreAtelier(slide.categorySlug)}
              className="px-8 py-4 rounded-md bg-surface/90 backdrop-blur-md border border-line hover:border-gold text-fg hover:text-gold font-semibold text-xs tracking-[0.2em] uppercase transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{slide.accentNote[language]}</span>
              <span className="text-xs text-fg-muted">({slide.priceNote[language]})</span>
            </button>
          </div>

          {/* Key Metrics Hallmark Bar */}
          <div className="pt-8 border-t border-line/80 grid grid-cols-2 sm:grid-cols-4 gap-6 text-left rtl:text-right">
            <div>
              <div className="font-serif-luxury text-xl font-bold text-fg">{t.hero.guaranteeAuth}</div>
              <div className="text-[11px] font-mono text-fg-muted uppercase tracking-wider mt-0.5">
                {language === 'ar' ? 'سند معتمد' : 'Bespoke Roster'}
              </div>
            </div>
            <div>
              <div className="font-serif-luxury text-xl font-bold text-fg">{t.hero.guaranteeSwiss}</div>
              <div className="text-[11px] font-mono text-fg-muted uppercase tracking-wider mt-0.5">
                {language === 'ar' ? 'معايير عالمية' : 'Artisanal Guilds'}
              </div>
            </div>
            <div>
              <div className="font-serif-luxury text-xl font-bold text-fg">{t.hero.guaranteeFreight}</div>
              <div className="text-[11px] font-mono text-fg-muted uppercase tracking-wider mt-0.5">
                {language === 'ar' ? 'شحن مؤمن' : 'Insured Freight'}
              </div>
            </div>
            <div>
              <div className="font-serif-luxury text-xl font-bold text-fg">{language === 'ar' ? 'ضمان 5 سنوات' : '5-Year Vault'}</div>
              <div className="text-[11px] font-mono text-fg-muted uppercase tracking-wider mt-0.5">
                {language === 'ar' ? 'ضمان استثنائي' : 'Artisanal Warranty'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Slider Navigation Controls & Indicators */}
      <div className="absolute bottom-8 right-8 rtl:right-auto rtl:left-8 z-20 hidden md:flex items-center gap-6 bg-surface/80 backdrop-blur-md border border-line p-3 rounded-lg">
        {/* Slide Counter */}
        <div className="font-mono text-xs text-fg-muted flex items-center gap-1.5 px-2">
          <span className="text-gold font-bold text-sm">
            0{currentSlideIndex + 1}
          </span>
          <span className="text-fg-faint">/</span>
          <span>0{HERO_SLIDES.length}</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded bg-raised hover:bg-line text-fg border border-line transition-colors cursor-pointer"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded bg-raised hover:bg-line text-fg border border-line transition-colors cursor-pointer"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </section>
  );
};
