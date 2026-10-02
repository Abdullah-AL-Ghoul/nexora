import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/auth/api-guards";
import { ADMIN_ROLES } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { userUpdateSchema } from "@/lib/validators/admin";

/**
 * PATCH /api/admin/users/[id] — role + active-state management (Admin only).
 * Guards: no self role change, no self deactivation, never remove the last
 * active admin. Disabling an account revokes its sessions immediately.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireApiRole(ADMIN_ROLES);
  if ("error" in gate) return gate.error;
  const actorId = gate.session.user.id;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (id === actorId && input.role !== undefined) {
    return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
  }
  if (id === actorId && input.isActive === false) {
    return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (input.role !== undefined && input.role !== target.role && target.role === "ADMIN") {
      const otherAdmins = await prisma.user.count({
        where: { role: "ADMIN", isActive: true, id: { not: id } },
      });
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: "Cannot demote the last active admin." },
          { status: 400 }
        );
      }
    }

    const disabling = input.isActive === false && target.isActive;
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: input,
        select: { id: true, role: true, isActive: true },
      });
      if (disabling) {
        await tx.session.deleteMany({ where: { userId: id } });
      }
      return updated;
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Unable to update user." }, { status: 500 });
  }
}
