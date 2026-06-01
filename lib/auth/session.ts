import { createClient } from '@/lib/supabase/server';
import type { AuthenticatedUser, UserRole } from '@/lib/types/auth';

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const meta = user.user_metadata;
  const appMeta = (user as { app_metadata?: Record<string, string> }).app_metadata ?? {};

  const tenantId = appMeta.tenant_id ?? meta?.tenant_id;
  const role = (appMeta.user_role ?? meta?.user_role) as UserRole | undefined;

  if (!tenantId || !role) return null;

  return {
    id: user.id,
    email: user.email ?? '',
    role,
    tenantId,
    staffId: appMeta.staff_id ?? undefined,
    clientId: appMeta.client_id ?? undefined,
  };
}

export async function requireRole(allowedRoles: UserRole[]): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error('Unauthenticated');
  }

  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Forbidden: requires one of [${allowedRoles.join(', ')}]`);
  }

  return user;
}
