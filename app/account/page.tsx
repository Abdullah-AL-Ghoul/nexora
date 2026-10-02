import { requireSession } from "@/lib/auth/guards";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Account" };

const roleLabel: Record<string, string> = {
  CUSTOMER: "Customer",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

export default async function AccountPage() {
  const session = await requireSession();
  const { user } = session;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My account</h1>
          <p className="text-sm text-muted-foreground">Profile and session overview</p>
        </div>
        <SignOutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account details as stored on the server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium text-foreground">{user.name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium text-foreground">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="secondary">{roleLabel[String(user.role)] ?? String(user.role)}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
