"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LogOut, Menu, Package, Search, ShieldAlert, User } from "lucide-react";
import { toast } from "sonner";

import { cn } from "cn";
import { CartButton } from "@/components/cart/cart-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrencySelector } from "@/components/currency/currency-selector";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { SearchDialog } from "@/components/search/search-dialog";

import { AnnouncementBar } from "@/components/layout/announcement-bar";

export type HeaderUser = {
  name: string;
  email: string;
  role?: string;
  wishlistCount?: number;
} | null;

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/categories", label: "Categories" },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 sm:gap-4 px-2.5 sm:px-4">
          <div className="flex items-center gap-1 sm:gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription className="sr-only">Navigation</SheetDescription>
                </SheetHeader>
                <nav className="mt-4 flex flex-col gap-1" aria-label="Mobile">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActivePath(pathname, item.href)
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/90 hover:bg-accent"
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <Link
                    href="/search"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-foreground/90 hover:bg-accent"
                  >
                    Search
                  </Link>
                  <div className="my-2 border-t border-border" />
                  <Link
                    href="/cart"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    Cart
                  </Link>
                  <Link
                    href="/wishlist"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    Wishlist
                  </Link>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Currency</span>
                    <CurrencySelector variant="outline" />
                  </div>
                  <div className="my-2 border-t border-border" />
                  {user ? (
                    <>
                      {user.role === "ADMIN" && (
                        <Link
                          href="/admin"
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/15"
                        >
                          <ShieldAlert className="size-4" />
                          Admin Dashboard
                        </Link>
                      )}
                      <Link
                        href="/account"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        My account
                      </Link>
                      <Link
                        href="/account/orders"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        Orders
                      </Link>
                      <form
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const { error } = await authClient.signOut();
                          if (error) {
                            toast.error(error.message ?? "Unable to sign out");
                            return;
                          }
                          setMobileOpen(false);
                          router.push("/");
                          router.refresh();
                        }}
                      >
                        <Button type="submit" variant="ghost" className="w-full justify-start px-3">
                          Sign out
                        </Button>
                      </form>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        Create account
                      </Link>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            <Link
              href="/"
              className="text-lg font-semibold tracking-[0.28em] text-foreground transition-colors hover:text-primary"
            >
              NEX<span className="text-primary">O</span>RA
            </Link>
          </div>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "group relative py-1.5 text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                  {/* Gold indicator bar — slides in on hover, stays on active. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-0 -bottom-px h-0.5 origin-left rounded-full bg-primary transition-transform duration-300",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Open search dialog (Press Cmd+K or Ctrl+K)"
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/70 hover:text-foreground cursor-pointer"
            >
              <Search className="size-3.5 text-primary" aria-hidden="true" />
              <span>Search catalog…</span>
              <kbd className="rounded border border-border/80 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shadow-xs">
                ⌘K
              </kbd>
            </button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Search"
              className="sm:hidden"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-5" aria-hidden="true" />
            </Button>

            <Button asChild variant="ghost" size="icon" aria-label="Wishlist">
              <Link href="/wishlist" className="relative">
                <Heart className="size-5" aria-hidden="true" />
                {user?.wishlistCount ? (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                    {user.wishlistCount > 9 ? "9+" : user.wishlistCount}
                  </span>
                ) : null}
              </Link>
            </Button>

            <CartButton />

            <CurrencySelector className="hidden md:inline-flex" />

            <ThemeToggle />

            <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Account menu">
                    <User className="size-5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === "ADMIN" && (
                    <DropdownMenuItem asChild className="bg-primary/5 font-medium text-primary focus:bg-primary/10">
                      <Link href="/admin">
                        <ShieldAlert className="size-4" aria-hidden="true" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <User className="size-4" aria-hidden="true" />
                      My account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/orders">
                      <Package className="size-4" aria-hidden="true" />
                      Orders
                    </Link>
                  </DropdownMenuItem>
                  <SignOutDropdownItem />
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

function SignOutDropdownItem() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <DropdownMenuItem
      disabled={pending}
      onSelect={async () => {
        setPending(true);
        const { error } = await authClient.signOut();
        setPending(false);
        if (error) {
          toast.error(error.message ?? "Unable to sign out");
          return;
        }
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {pending ? "Signing out…" : "Sign out"}
    </DropdownMenuItem>
  );
}
