import { UserControls } from "@/components/admin/user-controls";
import { Pager } from "@/components/pager";
import { ADMIN_ROLES, requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Users" };

const roleLabel: Record<string, string> = {
  CUSTOMER: "Customer",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

const USERS_PER_PAGE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await requireRole(ADMIN_ROLES);
  const currentUserId = session.user.id;

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const query = params.q?.trim().slice(0, 100) ?? "";

  const where = query ? { email: { contains: query, mode: "insensitive" as const } } : {};

  const [users, total, activeAdminCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: USERS_PER_PAGE,
      skip: (page - 1) * USERS_PER_PAGE,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / USERS_PER_PAGE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">
          Admin-only — role changes take effect immediately, disabling revokes sessions
        </p>
      </div>

      <form method="get" className="flex max-w-md items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by email…"
          aria-label="Search users by email"
          className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/60"
        />
        <button
          type="submit"
          className="h-9 shrink-0 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No users match this search.
        </p>
      ) : (
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
      )}

      <Pager
        page={page}
        pageCount={pageCount}
        label="Users pagination"
        hrefFor={(target) =>
          `/admin/users?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(target) }).toString()}`
        }
      />
    </div>
  );
}
