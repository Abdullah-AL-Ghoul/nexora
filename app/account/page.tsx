import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  Package, 
  ShoppingBag, 
  ArrowRight, 
  Sparkles, 
  Crown, 
  Clock, 
  MapPin,
  ExternalLink
} from "lucide-react";

import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ProfileEditor } from "@/components/account/profile-editor";
import { AddressManager } from "@/components/account/address-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Atelier Patron Portal — NEXORA" };

export default async function AccountPage() {
  const session = await requireSession();
  const { user: sessionUser } = session;

  if (sessionUser.role === "ADMIN" || sessionUser.role === "MANAGER") {
    redirect("/admin");
  }

  // Fetch full user record from database
  const [dbUser, defaultAddress, orderCount, recentOrders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.address.findFirst({
      where: { userId: sessionUser.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.order.count({
      where: { userId: sessionUser.id },
    }),
    prisma.order.findMany({
      where: { userId: sessionUser.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        items: true,
      },
    }),
  ]);

  const user = dbUser
    ? {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone,
        role: String(dbUser.role),
        createdAt: dbUser.createdAt,
      }
    : {
        id: sessionUser.id,
        name: sessionUser.name ?? "Valued Patron",
        email: sessionUser.email,
        phone: null,
        role: String(sessionUser.role ?? "CUSTOMER"),
        createdAt: new Date(),
      };

  const memberSinceYear = new Date(user.createdAt).getFullYear();
  const initials = (user.name || user.email || "N")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 lg:py-16 space-y-10">
      {/* Hero Welcome Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-primary/5 p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 size-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative size-16 sm:size-20 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 flex items-center justify-center text-xl sm:text-2xl font-serif font-bold text-primary shadow-inner">
              {initials}
              <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                <span className="size-1.5 rounded-full bg-white" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                  {user.name || "Valued Patron"}
                </h1>
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs font-medium gap-1">
                  <Crown className="size-3" />
                  Atelier Circle Member
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {user.email} • Patron since {memberSinceYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial gap-1.5">
              <Link href="/shop">
                <ShoppingBag className="size-3.5" />
                <span>Explore Shop</span>
              </Link>
            </Button>
            <SignOutButton />
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-border/60 pt-6">
          <div className="rounded-xl border border-border/40 bg-background/50 p-3.5">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
              <Package className="size-3.5 text-primary" />
              Total Orders
            </div>
            <div className="text-xl font-serif font-semibold text-foreground">
              {orderCount}
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-background/50 p-3.5">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
              <MapPin className="size-3.5 text-primary" />
              Delivery Status
            </div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
              {defaultAddress ? "✓ 1-Click Ready" : "Pending Address"}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-xl border border-border/40 bg-background/50 p-3.5">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
              <Sparkles className="size-3.5 text-primary" />
              Privilege Tier
            </div>
            <div className="text-xs font-semibold text-primary mt-1">
              Complimentary White-Glove
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Profile Details & Shipping Address */}
      <div className="grid gap-8 lg:grid-cols-2">
        <ProfileEditor user={user} />
        <AddressManager initialAddress={defaultAddress} />
      </div>

      {/* Recent Orders Section */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Recent Acquisitions & Orders
            </h3>
            <p className="text-xs text-muted-foreground">
              Track delivery progress and view itemized invoices for your luxury acquisitions.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Link href="/account/orders">
              <span>View All ({orderCount})</span>
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              <ShoppingBag className="size-6" />
            </div>
            <p className="text-sm font-medium text-foreground">No orders placed yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Browse our curated collection of timeless timepieces, fine jewelry, and leather goods.
            </p>
            <Button asChild size="sm" className="gap-1.5 mt-2">
              <Link href="/shop">
                <span>Start Shopping</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((ord) => (
              <div
                key={ord.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      #{ord.orderNumber}
                    </span>
                    <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                      {ord.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(ord.createdAt).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {formatPrice(ord.total)}
                  </span>
                  <Button asChild variant="ghost" size="sm" className="h-8 text-xs gap-1">
                    <Link href={`/account/orders/${ord.id}`}>
                      <span>Details</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
