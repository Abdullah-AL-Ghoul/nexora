import { requireRole } from "@/lib/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const session = await requireRole(["ADMIN", "MANAGER"]);
  const role = String(session.user.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">NEXORA operations overview</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Staff access verified <Badge variant="secondary">{role}</Badge>
          </CardTitle>
          <CardDescription>
            Analytics, revenue, and management modules are implemented in Phase 6.
            All metrics shown there will be clearly labeled as demo/seed data.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
