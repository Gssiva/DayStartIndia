import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type UserRole = "customer" | "worker" | "admin";

/**
 * Fetch all roles assigned to a user from user_roles table.
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("[security] Failed to fetch user roles:", error);
    return [];
  }

  return (data ?? []).map((r) => r.role as UserRole);
}

/**
 * Check if a user has a specific role.
 */
export async function hasRole(userId: string, role: UserRole): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes(role);
}

/**
 * Assert that the user possesses at least one of the allowed roles.
 * Throws an Error if unauthorized.
 */
export async function assertRole(
  userId: string,
  allowedRoles: UserRole[],
  customMessage?: string,
): Promise<void> {
  if (!userId) {
    throw new Error("Authentication required.");
  }

  const roles = await getUserRoles(userId);
  const isAuthorized = allowedRoles.some((role) => roles.includes(role));

  if (!isAuthorized) {
    throw new Error(
      customMessage ?? `Forbidden: Access restricted to [${allowedRoles.join(", ")}].`,
    );
  }
}

/**
 * Assert admin authorization.
 */
export async function assertAdmin(userId: string): Promise<void> {
  await assertRole(userId, ["admin"], "Forbidden: Administrator privileges required.");
}

/**
 * Assert worker authorization.
 */
export async function assertWorker(userId: string): Promise<void> {
  await assertRole(userId, ["worker"], "Forbidden: Worker account required.");
}

/**
 * Assert customer authorization.
 */
export async function assertCustomer(userId: string): Promise<void> {
  await assertRole(userId, ["customer"], "Forbidden: Customer account required.");
}

/**
 * Log an administrative audit action into admin_audit_logs.
 */
export async function logAdminAudit(params: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: params.adminId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      details: (params.details ?? {}) as import("@/integrations/supabase/types").Json,
      ip_address: params.ipAddress ?? null,
    });

    if (error) {
      console.error("[audit] Failed to write admin audit log:", error);
    }
  } catch (err) {
    console.error("[audit] Exception writing admin audit log:", err);
  }
}
