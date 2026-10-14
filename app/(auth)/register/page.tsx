import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guards";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/shop");

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Create an Account
        </h1>
        <p className="text-sm text-muted-foreground">
          Join the NEXORA circle for bespoke recommendations and private previews.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
