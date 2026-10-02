import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guards";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/account");

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
        <p className="text-sm text-muted-foreground">Join NEXORA — it only takes a moment</p>
      </div>
      <RegisterForm />
    </div>
  );
}
