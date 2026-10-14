import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guards";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.redirect === "string" ? params.redirect : "";
  const session = await getSession();
  if (session) {
    const role = String((session.user as { role?: string }).role);
    if (role === "ADMIN" || role === "MANAGER") {
      redirect("/admin");
    } else {
      redirect(raw.startsWith("/") && !raw.startsWith("//") ? raw : "/shop");
    }
  }

  const safeRedirect = raw.startsWith("/") && !raw.startsWith("//") ? raw : "";

  return (
    <div className="w-full">
      <Suspense fallback={<div className="h-64 flex items-center justify-center text-xs text-muted-foreground">Loading atelier portal…</div>}>
        <LoginForm redirectTo={safeRedirect} />
      </Suspense>
    </div>
  );
}
