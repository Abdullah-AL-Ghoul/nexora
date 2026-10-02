"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Search, User } from "lucide-react";
import { toast } from "sonner";

import { cn } from "cn";
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

export type HeaderUser = { name: string; email: string } | null;

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

  return (
    <>
      <div className="bg-primary text-primary-foreground">
        <p className="mx-auto max-w-7xl px-4 py-1.5 text-center text-[11px] tracking-wide">
          Complimentary shipping on orders over $100 · Easy 30-day returns
        </p>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2">
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
                  {user ? (
                    <>
                      <Link
                        href="/account"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        My account
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
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative py-1 text-sm font-medium transition-colors",
                  isActivePath(pathname, item.href)
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="Search">
              <Link href="/search">
                <Search className="size-5" aria-hidden="true" />
              </Link>
            </Button>

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
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <User className="size-4" aria-hidden="true" />
                      My account
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
