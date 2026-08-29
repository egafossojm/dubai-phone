import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, type PermissionCode } from "@/lib/auth/permissions";
import type { AuthUser } from "@/lib/auth/session";

export async function requirePagePermission(
  permission: PermissionCode,
): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!hasPermission(user.permissions, permission)) {
    redirect("/");
  }
  return user;
}
