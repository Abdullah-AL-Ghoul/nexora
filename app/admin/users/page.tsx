import { UserControls } from "@/components/admin/user-controls";
import { ADMIN_ROLES, requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Users" };

const roleLabel: Record<string, string> = {
  CUSTOMER: "Customer",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

export default async function AdminUsersPage() {
  const session = await requireRole(ADMIN_ROLES);
  const currentUserId = session.user.id;

  const [users, activeAdminCount] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    }),
    prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">
          Admin-only — role changes take effect immediately, disabling revokes sessions
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Controls</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 text-foreground">{user.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                    {roleLabel[user.role] ?? user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      user.isActive
                        ? "text-muted-foreground"
                        : "font-medium text-destructive"
                    }
                  >
                    {user.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  <UserControls
                    userId={user.id}
                    role={user.role}
                    isActive={user.isActive}
                    isSelf={user.id === currentUserId}
                    isLastAdmin={activeAdminCount <= 1}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
