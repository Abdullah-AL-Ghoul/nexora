import React, { useEffect, useMemo, lazy, Suspense, Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useStore } from './store/useStore';
import { setRouterNavigate } from './lib/routerBridge';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { CartDrawer } from './components/store/CartDrawer';
import { QuickViewModal } from './components/store/QuickViewModal';
import { ToastContainer } from './components/ui/ToastContainer';
import { MarketIntelligenceModal } from './components/store/MarketIntelligenceModal';
import { fetchCurrentUser } from './lib/api';

// Code-split pages (performance: initial bundle only carries the active route)
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ShopPage = lazy(() => import('./pages/ShopPage').then((m) => ({ default: m.ShopPage })));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage').then((m) => ({ default: m.OrderSuccessPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const WishlistPage = lazy(() => import('./pages/WishlistPage').then((m) => ({ default: m.WishlistPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="h-8 w-8 animate-spin text-gold" />
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message?: string }> {
  state: { hasError: boolean; message?: string } = { hasError: false };
  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-4xl" aria-hidden>🛠</div>
          <h1 className="font-serif-luxury text-2xl">Something went wrong</h1>
          <p className="max-w-md text-sm text-fg-muted">An unexpected error interrupted this page.</p>
          {this.state.message && (
            <details className="max-w-lg rounded-md border border-line bg-raised px-4 py-3 text-left text-xs text-fg-muted">
              <summary className="cursor-pointer font-medium text-gold">Error details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.message}</pre>
            </details>
          )}
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="rounded-md bg-gold px-5 py-2 font-medium text-ink hover:bg-gold-soft"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Keeps the legacy store routeParams/currentRoute in sync with the real URL
 *  so pre-migration pages that read `routeParams` keep working. */
function RouteParamsSync() {
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    const path = location.pathname;
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    const [seg, sub] = cleanPath.split('/');
    const routeMap: Record<string, string> = {
      '': 'home', 'shop': 'shop', 'categories': 'categories', 'about': 'about',
      'product': 'product', 'checkout': 'checkout', 'orders': 'orders',
      'wishlist': 'wishlist', 'admin': 'admin-dashboard', 'login': 'login',
      'order-success': 'order-success',
    };
    const route = routeMap[seg] ?? routeMap[cleanPath] ?? 'home';
    // Use a lightweight store write (not navigate) to avoid loops
    useStore.setState((s) => ({
      currentRoute: route,
      routeParams: { ...(params ?? {}), ...(sub ? { orderId: sub } : {}) },
    }));
  }, [location.pathname]);

  return null;
}

function AppShell() {
  const { language, switchRole } = useStore();
  const [isCartOpen, setIsCartOpen] = React.useState(false);
  const [isMarketIntelligenceOpen, setIsMarketIntelligenceOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Bridge store.navigate() → react-router
  useEffect(() => {
    setRouterNavigate((to) => navigate(to));
  }, [navigate]);

  // Resolve server-determined role → local store user (no email guessing)
  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        switchRole(u.role as 'CUSTOMER' | 'MANAGER' | 'ADMIN');
      })
      .catch(() => { /* guest browsing is fine */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync document direction and language
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="min-h-screen flex flex-col bg-ink text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:top-4 focus:left-4 focus:rounded focus:bg-gold focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <Navbar onOpenCart={() => setIsCartOpen(true)} onOpenMarketIntelligence={() => setIsMarketIntelligenceOpen(true)} />

      <main id="main-content" className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/product/:slug" element={<ProductDetailPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Suspense>
      </main>

      <RouteParamsSync />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <QuickViewModal />
      <MarketIntelligenceModal isOpen={isMarketIntelligenceOpen} onClose={() => setIsMarketIntelligenceOpen(false)} />
      <ToastContainer />
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
