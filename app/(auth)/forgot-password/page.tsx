import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold text-foreground">Forgot password?</h1>
        <p className="text-sm text-muted-foreground">We&apos;ll email you a link to reset it</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
