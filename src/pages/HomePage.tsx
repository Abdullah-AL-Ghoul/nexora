import React from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../i18n/useTranslation';
import { db } from '../lib/db';
import { ProductGrid } from '../components/store/ProductGrid';
import { HeroSection } from '../components/store/HeroSection';
import { ArrowRight, ShieldCheck, Award, Clock } from 'lucide-react';

export const HomePage: React.FC = () => {
  const { navigate, setSelectedCategory } = useStore();
  const { t, language, isRtl, localizeCategory } = useTranslation();

  const rawCategories = db.getCategories();
  const categories = rawCategories.map(localizeCategory);
  const trendingProducts = db.getProducts({ featuredOnly: true }).slice(0, 4);
  const bestSellers = db.getProducts({ sortBy: 'popular' }).slice(0, 4);

  return (
    <div className="space-y-24 pb-20">
      {/* 1. High-Impact Luxury Imagery Slider Hero Section */}
      <HeroSection />

      {/* 2. Featured Categories (8 Ateliers) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-[#C9A961] font-semibold">
              {t.home.curatedTitle}
            </span>
            <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#F5F5F5] mt-1">
              {language === 'ar' ? 'اختر تخصصك الحرفي' : 'Select Your Discipline'}
            </h2>
          </div>
          <button
            onClick={() => navigate('categories')}
            className="text-xs text-[#9CA3AF] hover:text-[#C9A961] flex items-center gap-1 transition-colors self-start md:self-auto cursor-pointer"
          >
            <span>{t.home.viewAllAteliers}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.slug);
                navigate('shop');
              }}
              className="group relative h-72 rounded-lg overflow-hidden border border-[#242831] hover:border-[#C9A961]/50 cursor-pointer transition-all duration-300 bg-[#171A1F]"
            >
              <img
                src={cat.imageUrl}
                alt={cat.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F1113] via-[#0F1113]/40 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-5 space-y-1">
                <span className="text-[11px] font-mono text-[#C9A961] uppercase tracking-wider">
                  {cat.itemCount} {language === 'ar' ? 'قطع معتمدة' : 'Artifacts'}
                </span>
                <h3 className="font-serif-luxury text-lg font-bold text-[#F5F5F5] group-hover:text-[#C9A961] transition-colors">
                  {cat.name}
                </h3>
                <p className="text-xs text-[#9CA3AF] line-clamp-1 font-light">
                  {cat.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Trending Curations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-[#C9A961] font-semibold">
              {t.home.trendingTitle}
            </span>
            <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#F5F5F5] mt-1">
              {t.home.trendingSubtitle}
            </h2>
          </div>
          <button
            onClick={() => {
              setSelectedCategory('all');
              navigate('shop');
            }}
            className="text-xs text-[#9CA3AF] hover:text-[#C9A961] flex items-center gap-1 transition-colors self-start md:self-auto cursor-pointer"
          >
            <span>{t.home.exploreFullCatalog}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

        <ProductGrid products={trendingProducts} />
      </section>

      {/* 4. Special Editorial Offer / Promotion */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl overflow-hidden bg-[#171A1F] border border-[#242831] p-8 sm:p-14 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#242831] text-[11px] font-mono text-[#C9A961] uppercase tracking-wider">
              <span>{language === 'ar' ? 'عرض السجل الحصري' : 'Private Dispatch Offer'}</span>
            </div>

            <h2 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-[#F5F5F5] leading-tight">
              {language === 'ar' ? (
                <>
                  كرونوغراف إيثلغارد & <br />
                  طقم الجلود التوسكانية الفاخرة
                </>
              ) : (
                <>
                  Aethelgard Chronograph & <br />
                  Tuscan Saddle Leather Set
                </>
              )}
            </h2>

            <p className="text-sm text-[#9CA3AF] leading-relaxed">
              {language === 'ar' ? (
                <>
                  اقتنِ أي ساعة ميكانيكية هذا الموسم واحصل على رصيد 10% مجاناً عبر كود{' '}
                  <strong className="text-[#C9A961] font-mono tracking-wider">NEXORA10</strong> أو وفّر 50$ مع{' '}
                  <strong className="text-[#C9A961] font-mono tracking-wider">PRECISION50</strong> للطلبات فوق 250$.
                </>
              ) : (
                <>
                  Order any horological timepiece this season and unlock 10% complimentary atelier credit with code{' '}
                  <strong className="text-[#C9A961] font-mono tracking-wider">NEXORA10</strong> or save $50 with{' '}
                  <strong className="text-[#C9A961] font-mono tracking-wider">PRECISION50</strong> on orders over $250.
                </>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => {
                  setSelectedCategory('timepieces');
                  navigate('shop');
                }}
                className="px-6 py-3 rounded bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'اقتناء الساعات' : 'Acquire Horology'}
              </button>
              <button
                onClick={() => {
                  setSelectedCategory('minimalist-leather');
                  navigate('shop');
                }}
                className="px-6 py-3 rounded bg-[#121418] border border-[#242831] hover:border-[#C9A961] text-[#F5F5F5] font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'معاينة الجلود' : 'Inspect Leather'}
              </button>
            </div>
          </div>

          <div className="relative aspect-video lg:aspect-square rounded-xl overflow-hidden border border-[#242831]">
            <img
              src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80"
              alt="Horology and Leather curation"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* 5. Best Sellers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-[#C9A961] font-semibold">
              {t.home.bestSellersTitle}
            </span>
            <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#F5F5F5] mt-1">
              {t.home.bestSellersSubtitle}
            </h2>
          </div>
          <button
            onClick={() => {
              setSelectedCategory('all');
              navigate('shop');
            }}
            className="text-xs text-[#9CA3AF] hover:text-[#C9A961] flex items-center gap-1 transition-colors self-start md:self-auto cursor-pointer"
          >
            <span>{t.home.exploreFullCatalog}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

        <ProductGrid products={bestSellers} />
      </section>

      {/* 6. Why NEXORA Architectural Manifesto */}
      <section className="bg-[#121418] border-y border-[#242831] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase tracking-[0.2em] text-[#C9A961] font-semibold">
              {language === 'ar' ? 'دستور نكسورا المعماري' : 'The NEXORA Constitution'}
            </span>
            <h2 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-[#F5F5F5]">
              {language === 'ar' ? 'صنعت لتدوم وتتحدى تبدل الموضة السريعة' : 'Built to Outlast Fleeting Trends'}
            </h2>
            <p className="text-sm text-[#9CA3AF] leading-relaxed">
              {language === 'ar'
                ? 'نرفض الاستهلاك المؤقت السريع. يتم اختيار كل مادة وتصميم في تشكيلتنا لقابليتها للإصلاح، ونقائها الحسي، واستدامتها لعقود.'
                : 'We reject transient disposable consumerism. Every component in our catalog is chosen for repairability, tactile purity, and authentic materials that mature with character.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left rtl:text-right">
            <div className="p-8 rounded-lg bg-[#171A1F] border border-[#242831] space-y-4">
              <div className="w-12 h-12 rounded-md bg-[#121418] border border-[#242831] flex items-center justify-center text-[#C9A961]">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-serif-luxury text-lg font-bold text-[#F5F5F5]">
                {language === 'ar' ? 'احتياطي طاقة 70 ساعة' : '70-Hour Power Reserves'}
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                {language === 'ar'
                  ? 'حركات سويسرية كولوم-ويل معدلة بخمس وضعيات مع عجلات توازن غلوسيدور المقاومة للمجالات المغناطيسية.'
                  : 'Swiss-manufactured column-wheel calibers adjusted in five positions with Glucydur balance wheels.'}
              </p>
            </div>

            <div className="p-8 rounded-lg bg-[#171A1F] border border-[#242831] space-y-4">
              <div className="w-12 h-12 rounded-md bg-[#121418] border border-[#242831] flex items-center justify-center text-[#C9A961]">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-serif-luxury text-lg font-bold text-[#F5F5F5]">
                {language === 'ar' ? 'مشغلات بلانار بنقاء البيريليوم' : 'Beryllium Planar Drivers'}
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                {language === 'ar'
                  ? 'أغشية مغناطيسية متناهية الرقة تتفاعل بديناميكية فورية بدون أي تشويش لتوفير أدق تفاصيل النغمات.'
                  : 'Ultra-thin magnetic diaphragms that react with instantaneous micro-dynamics and zero distortion.'}
              </p>
            </div>

            <div className="p-8 rounded-lg bg-[#171A1F] border border-[#242831] space-y-4">
              <div className="w-12 h-12 rounded-md bg-[#121418] border border-[#242831] flex items-center justify-center text-[#C9A961]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-serif-luxury text-lg font-bold text-[#F5F5F5]">
                {language === 'ar' ? 'جلود توسكانية كاملة الحبيبات' : 'Full-Grain Tuscan Hides'}
              </h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                {language === 'ar'
                  ? 'دباغة نباتية بطيئة بمستخلصات لحاء الكستناء لأكثر من 60 يوماً تمنح الجلد ملمساً زبدياً غنياً يزداد بهاءً مع الزمن.'
                  : 'Slow-tanned in chestnut and mimosa extracts for over 60 days, yielding butter-soft resilience.'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
