import { CartHydration } from "@/components/cart/cart-hydration";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader, type HeaderUser } from "@/components/layout/site-header";
import { getSession } from "@/lib/auth/guards";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const user: HeaderUser = session
    ? { name: session.user.name, email: session.user.email }
    : null;

  return (
    <>
      <CartHydration />
      <SiteHeader user={user} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
