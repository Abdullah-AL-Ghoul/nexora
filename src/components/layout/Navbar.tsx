import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  ShoppingBag,
  Heart,
  Search,
  Menu,
  X,
  LayoutDashboard,
  Globe,
  LogIn,
  LogOut,
} from 'lucide-react';

interface NavbarProps {
  onOpenCart: () => void;
  onOpenMarketIntelligence: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCart, onOpenMarketIntelligence }) => {
  const {
    currentRoute,
    navigate,
    getCartItemCount,
    wishlist,
    currentUser,
    logout,
    searchQuery,
    setSearchQuery,
    setSelectedCategory,
  } = useStore();

  const { t, language, setLanguage } = useTranslation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const itemCount = getCartItemCount();
  const wishlistCount = wishlist.length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('shop');
      setIsSearchOpen(false);
    }
  };

  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-40 bg-ink/95 backdrop-blur-md border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Mobile menu trigger */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-fg-muted hover:text-fg focus:outline-none cursor-pointer"
              aria-label="Toggle Navigation"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate('home')}
              className="flex items-baseline gap-1.5 group text-left cursor-pointer"
            >
              <span className="font-serif-luxury text-2xl font-bold tracking-[0.2em] text-fg group-hover:text-gold transition-colors">
                NEXORA
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-medium tracking-wide">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  navigate('shop');
                }}
                className={`transition-colors py-1 cursor-pointer ${
                  currentRoute === 'shop'
                    ? 'text-gold border-b-2 border-gold'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {t.nav.collection}
              </button>
              <button
                onClick={() => navigate('categories')}
                className={`transition-colors py-1 cursor-pointer ${
                  currentRoute === 'categories'
                    ? 'text-gold border-b-2 border-gold'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {t.nav.categories}
              </button>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  navigate('shop', { filter: 'trending' });
                }}
                className="text-fg-muted hover:text-fg transition-colors py-1 cursor-pointer"
              >
                {t.nav.trending}
              </button>
              <button
                onClick={() => navigate('about')}
                className={`transition-colors py-1 cursor-pointer ${
                  currentRoute === 'about'
                    ? 'text-gold border-b-2 border-gold'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {t.nav.philosophy}
              </button>
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Bilingual Language Switcher */}
            <div className="flex items-center rounded-md bg-surface border border-line p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLanguage('ar')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  language === 'ar'
                    ? 'bg-gold text-ink font-bold shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
                title="التحويل إلى اللغة العربية"
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-gold text-ink font-bold shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
                title="Switch to English"
              >
                EN
              </button>
            </div>

            {/* Search Bar Input or Toggle */}
            <div className="relative">
              {isSearchOpen ? (
                <form onSubmit={handleSearchSubmit} className="flex items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.nav.searchPlaceholder}
                    autoFocus
                    className="w-48 sm:w-64 bg-surface border border-gold text-xs text-fg px-3 py-2 rounded-md outline-none placeholder:text-fg-faint"
                  />
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    className="ml-2 rtl:ml-0 rtl:mr-2 text-xs text-fg-faint hover:text-white cursor-pointer"
                  >
                    {t.nav.searchCancel}
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 text-fg-muted hover:text-fg transition-colors cursor-pointer"
                  aria-label="Search Catalog"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Live Market Intelligence */}
            <button
              onClick={onOpenMarketIntelligence}
              className="p-2 text-fg-muted hover:text-gold transition-colors cursor-pointer flex items-center gap-1.5"
              title={t.nav.intelligence}
              aria-label="Market Intelligence"
            >
              <Globe className="w-5 h-5 text-gold" />
              <span className="hidden xl:inline text-xs font-medium text-gold">
                {t.nav.intelligence}
              </span>
            </button>

            {/* Wishlist */}
            <button
              onClick={() => navigate('wishlist')}
              className="relative p-2 text-fg-muted hover:text-fg transition-colors cursor-pointer"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 rtl:right-auto rtl:left-1 w-4 h-4 bg-gold text-ink rounded-full text-[10px] font-bold flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart / Bag Button */}
            <button
              onClick={onOpenCart}
              className="relative p-2 text-fg-muted hover:text-gold transition-colors cursor-pointer flex items-center gap-1.5"
              aria-label="Shopping Bag"
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="w-5 h-5 bg-gold text-ink rounded-full text-[11px] font-bold flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Admin Dashboard shortcut ONLY if logged in as Admin */}
            {isAdmin && (
              <button
                onClick={() => navigate('admin-dashboard')}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-gold/15 border border-gold/60 text-gold hover:bg-gold/25 transition-colors cursor-pointer shadow-sm"
                title={t.nav.dashboard}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-gold" />
                <span className="hidden sm:inline">{t.nav.dashboard}</span>
              </button>
            )}

            {/* Auth Button: Direct Login or Sign Out if Admin */}
            {isAdmin ? (
              <button
                onClick={() => {
                  logout();
                  navigate('home');
                }}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-surface border border-line hover:border-danger/50 text-fg-muted hover:text-danger transition-colors cursor-pointer"
                title={language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === 'ar' ? 'خروج' : 'Sign Out'}</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('login')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                  currentRoute === 'login'
                    ? 'bg-gold text-ink border-gold'
                    : 'bg-surface border-line text-fg hover:border-gold hover:text-gold'
                }`}
                title={t.nav.login}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.nav.login}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-line bg-ink px-4 pt-3 pb-6 space-y-4">
          <div className="flex flex-col space-y-2 text-sm font-medium">
            <button
              onClick={() => {
                setSelectedCategory('all');
                navigate('shop');
                setIsMobileMenuOpen(false);
              }}
              className="text-left rtl:text-right py-2 text-fg-muted hover:text-gold"
            >
              {t.nav.collection}
            </button>
            <button
              onClick={() => {
                navigate('categories');
                setIsMobileMenuOpen(false);
              }}
              className="text-left rtl:text-right py-2 text-fg-muted hover:text-gold"
            >
              {t.nav.categories}
            </button>
            <button
              onClick={() => {
                navigate('about');
                setIsMobileMenuOpen(false);
              }}
              className="text-left rtl:text-right py-2 text-fg-muted hover:text-gold"
            >
              {t.nav.philosophy}
            </button>

            {isAdmin ? (
              <>
                <button
                  onClick={() => {
                    navigate('admin-dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left rtl:text-right py-2 text-gold font-semibold flex items-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>{t.nav.dashboard}</span>
                </button>
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                    navigate('home');
                  }}
                  className="text-left rtl:text-right py-2 text-danger hover:text-rose-300 font-medium flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  navigate('login');
                  setIsMobileMenuOpen(false);
                }}
                className="text-left rtl:text-right py-2 text-fg hover:text-gold flex items-center gap-2"
              >
                <LogIn className="w-4 h-4 text-gold" />
                <span>{t.nav.login}</span>
              </button>
            )}

            {/* Mobile language switch */}
            <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
              <span className="text-xs text-fg-muted flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-gold" />
                <span>{language === 'ar' ? 'اللغة / Language:' : 'Language / اللغة:'}</span>
              </span>
              <div className="flex items-center rounded-md bg-surface border border-line p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('ar');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    language === 'ar'
                      ? 'bg-gold text-ink font-bold'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  العربية
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    language === 'en'
                      ? 'bg-gold text-ink font-bold'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
