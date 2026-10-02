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
  const safeRedirect = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";

  const session = await getSession();
  if (session) redirect(safeRedirect);

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your NEXORA account</p>
      </div>
      <LoginForm redirectTo={safeRedirect} />
    </div>
  );
}
