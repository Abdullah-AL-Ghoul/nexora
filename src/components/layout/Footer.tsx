import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Shield, Award, RotateCcw, Clock, ArrowRight, Check } from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigate, setSelectedCategory, addToast, currentUser } = useStore();
  const { t, language } = useTranslation();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && email.includes('@')) {
      setSubscribed(true);
      addToast({
        type: 'success',
        title: language === 'ar' ? 'تم الاشتراك بنجاح' : 'Atelier Gazette Subscription Active',
        message: language === 'ar'
          ? `سيتم إرسال إشعارات الإصدارات الحصرية إلى ${email}.`
          : `Dispatches on limited releases will be forwarded to ${email}.`,
      });
      setEmail('');
    }
  };

  return (
    <footer className="bg-[#0B0D0F] border-t border-[#242831] text-[#9CA3AF] text-sm">
      {/* Value Pillars */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-b border-[#1E2229]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#171A1F] border border-[#242831] flex items-center justify-center shrink-0 text-[#C9A961]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider">
                {language === 'ar' ? 'أصالة معتمدة 100%' : 'Certified Authenticity'}
              </h4>
              <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                {language === 'ar'
                  ? 'توريد مباشر من بيوت الحرفة مع شهادات منشأ ورقم تسلسلي موثق.'
                  : 'Direct atelier sourcing with blockchain-stamped serial certificates.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#171A1F] border border-[#242831] flex items-center justify-center shrink-0 text-[#C9A961]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider">
                {language === 'ar' ? 'ضمان دولي شامل لـ 5 سنوات' : '5-Year Bespoke Warranty'}
              </h4>
              <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                {language === 'ar'
                  ? 'صيانة شاملة للمحركات والتروس وتغطية كاملة لجودة الخامات الطبيعية.'
                  : 'Comprehensive movement overhaul and artisanal material coverage.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#171A1F] border border-[#242831] flex items-center justify-center shrink-0 text-[#C9A961]">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider">
                {language === 'ar' ? 'استرجاع ميسر خلال 30 يوماً' : '30-Day Discreet Returns'}
              </h4>
              <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                {language === 'ar'
                  ? 'استلام مؤمن عبر شحن خاص بصندوق الحفظ الأصلي دون أي تعقيد.'
                  : 'Insured collection via private courier in original vault packaging.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#171A1F] border border-[#242831] flex items-center justify-center shrink-0 text-[#C9A961]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider">
                {language === 'ar' ? 'مستشار اقتناء خاص' : 'Private Concierge'}
              </h4>
              <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                {language === 'ar'
                  ? 'إرشاد متمرس لضبط المقاسات، استشارات ساعاتية، ودعم دائم.'
                  : 'Bespoke sizing, horological advice, and dedicated client advisors.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand Manifesto */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif-luxury text-2xl font-bold tracking-[0.2em] text-[#F5F5F5]">NEXORA</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A961]" />
            </div>
            <p className="text-xs text-[#9CA3AF] leading-relaxed max-w-sm">
              {t.footer.brandTagline}
            </p>
            <div className="pt-2">
              <form onSubmit={handleSubscribe} className="flex max-w-sm">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={language === 'ar' ? 'أدخل بريدك للاشتراك بالسجل الخاص...' : 'Enter email for private dispatches...'}
                  required
                  className="bg-[#171A1F] border border-[#242831] text-xs text-[#F5F5F5] px-3.5 py-2.5 rounded-l-md rtl:rounded-l-none rtl:rounded-r-md outline-none focus:border-[#C9A961] flex-1"
                />
                <button
                  type="submit"
                  className="bg-[#C9A961] text-[#0F1113] hover:bg-[#E7D3A0] px-4 py-2.5 rounded-r-md rtl:rounded-r-none rtl:rounded-l-md font-semibold text-xs tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>{language === 'ar' ? 'انضمام' : 'JOIN'}</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </form>
              {subscribed && (
                <p className="text-[11px] text-[#C9A961] mt-1.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {language === 'ar' ? 'مرحباً بك في السجل الخاص للعملاء.' : 'Welcome to the private client registry.'}
                </p>
              )}
            </div>
          </div>

          {/* Ateliers */}
          <div>
            <h5 className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider mb-4">
              {t.footer.ateliers}
            </h5>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  onClick={() => {
                    setSelectedCategory('timepieces');
                    navigate('shop');
                  }}
                  className="hover:text-[#C9A961] transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'الساعات الفاخرة' : 'Timepieces'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setSelectedCategory('audio-engineering');
                    navigate('shop');
                  }}
                  className="hover:text-[#C9A961] transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'الهندسة الصوتية' : 'Audio Engineering'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setSelectedCategory('minimalist-leather');
                    navigate('shop');
                  }}
                  className="hover:text-[#C9A961] transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'المصنوعات الجلدية' : 'Minimalist Leather'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setSelectedCategory('architectural-workspace');
                    navigate('shop');
                  }}
                  className="hover:text-[#C9A961] transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'مساحات العمل المعمارية' : 'Architectural Workspace'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setSelectedCategory('modern-optics');
                    navigate('shop');
                  }}
                  className="hover:text-[#C9A961] transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'البصريات المعاصرة' : 'Modern Optics'}
                </button>
              </li>
            </ul>
          </div>

          {/* Client Experience */}
          <div>
            <h5 className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider mb-4">
              {language === 'ar' ? 'خدمات العملاء' : 'Client Experience'}
            </h5>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => navigate('orders')} className="hover:text-[#C9A961] transition-colors cursor-pointer">
                  {language === 'ar' ? 'تتبع الطلبات والشحنات' : 'Order Tracking'}
                </button>
              </li>
              <li>
                <button onClick={() => navigate('wishlist')} className="hover:text-[#C9A961] transition-colors cursor-pointer">
                  {language === 'ar' ? 'قائمة المقتنيات المفضلة' : 'Curated Wishlist'}
                </button>
              </li>
              <li>
                <button onClick={() => navigate('about')} className="hover:text-[#C9A961] transition-colors cursor-pointer">
                  {language === 'ar' ? 'فلسفة وتراث نكسورا' : 'Brand Philosophy'}
                </button>
              </li>
              {currentUser.role === 'ADMIN' && (
                <li>
                  <button onClick={() => navigate('admin-dashboard')} className="hover:text-[#C9A961] transition-colors cursor-pointer">
                    {language === 'ar' ? 'لوحة التحكم والعمليات (Console)' : 'Operations Console'}
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom copyright and compliance */}
        <div className="mt-16 pt-8 border-t border-[#1E2229] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9CA3AF]">
          <div>
            &copy; {new Date().getFullYear()} NEXORA ATELIER S.A. {t.footer.rights}
          </div>
          <div className="flex items-center gap-6">
            <span>GENEVA</span>
            <span>·</span>
            <span>ZURICH</span>
            <span>·</span>
            <span>TOKYO</span>
            <span>·</span>
            <span>NEW YORK</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
