import React, { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { CartDrawer } from './components/store/CartDrawer';
import { QuickViewModal } from './components/store/QuickViewModal';
import { ToastContainer } from './components/ui/ToastContainer';
import { MarketIntelligenceModal } from './components/store/MarketIntelligenceModal';
import { auth, onAuthStateChanged } from './lib/firebase';
import { db } from './lib/db';

// Pages
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { OrdersPage } from './pages/OrdersPage';
import { WishlistPage } from './pages/WishlistPage';
import { AboutPage } from './pages/AboutPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { LoginPage } from './pages/LoginPage';

export default function App() {
  const { currentRoute, switchRole, language, loadFirestoreWishlist } = useStore();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMarketIntelligenceOpen, setIsMarketIntelligenceOpen] = useState(false);

  // Sync document direction and language
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Sync Firebase authenticated state and wishlist
  useEffect(() => {
    // Initial wishlist hydration from Firestore
    loadFirestoreWishlist();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        let role: 'CUSTOMER' | 'MANAGER' | 'ADMIN' = 'CUSTOMER';
        if (
          firebaseUser.email === 'ynab2025@gmail.com' ||
          firebaseUser.email?.includes('admin')
        ) {
          role = 'ADMIN';
        }
        db.registerUser(
          firebaseUser.displayName || 'Distinguished Collector',
          firebaseUser.email || 'collector@nexora.com',
          role
        );
        switchRole(role);
        // Load user's saved wishlist from Firestore
        loadFirestoreWishlist(firebaseUser.uid);
      }
    });

    return () => unsubscribe();
  }, [switchRole, loadFirestoreWishlist]);

  const renderCurrentPage = () => {
    switch (currentRoute) {
      case 'home':
        return <HomePage />;
      case 'shop':
        return <ShopPage />;
      case 'categories':
        return <CategoriesPage />;
      case 'product':
        return <ProductDetailPage />;
      case 'checkout':
        return <CheckoutPage />;
      case 'order-success':
        return <OrderSuccessPage />;
      case 'orders':
        return <OrdersPage />;
      case 'wishlist':
        return <WishlistPage />;
      case 'about':
        return <AboutPage />;
      case 'admin-dashboard':
        return <AdminDashboardPage />;
      case 'login':
        return <LoginPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0F1113] text-[#F5F5F5]">
      {/* Main Navigation */}
      <Navbar
        onOpenCart={() => setIsCartOpen(true)}
        onOpenMarketIntelligence={() => setIsMarketIntelligenceOpen(true)}
      />

      {/* Dynamic Route View */}
      <main className="flex-1">
        {renderCurrentPage()}
      </main>

      {/* Global Interactive Drawers & Overlays */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <QuickViewModal />
      <MarketIntelligenceModal
        isOpen={isMarketIntelligenceOpen}
        onClose={() => setIsMarketIntelligenceOpen(false)}
      />
      <ToastContainer />

      {/* Universal Footer */}
      <Footer />
    </div>
  );
}
