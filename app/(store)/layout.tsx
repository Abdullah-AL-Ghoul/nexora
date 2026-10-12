import { Suspense } from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartHydration } from "@/components/cart/cart-hydration";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader, type HeaderUser } from "@/components/layout/site-header";
import { TopProgressBar } from "@/components/layout/top-progress-bar";
import { getSession } from "@/lib/auth/guards";
import { getWishlistCount } from "@/lib/queries/wishlist";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  const [wishlistCount] = session
    ? await Promise.all([getWishlistCount(session.user.id)])
    : [0];

  const user: HeaderUser = session
    ? {
        name: session.user.name,
        email: session.user.email,
        role: String((session.user as { role?: string }).role || "CUSTOMER"),
        wishlistCount,
      }
    : null;

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Suspense fallback={null}>
        <TopProgressBar />
      </Suspense>
      <CartHydration />
      <CartDrawer />
      <SiteHeader user={user} />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
