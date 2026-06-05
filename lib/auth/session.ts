import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { AuthenticatedUser, UserRole } from '@/lib/types/auth';

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const meta = user.user_metadata;
  const appMeta = (user as { app_metadata?: Record<string, string> }).app_metadata ?? {};

  // Fast path: role/tenant present in app_metadata. Staff/clients created via
  // the admin API carry these; the custom_access_token_hook also injects them.
  let tenantId: string | undefined = appMeta.tenant_id ?? meta?.tenant_id;
  let role: UserRole | undefined = (appMeta.user_role ?? meta?.user_role) as UserRole | undefined;
  let staffId: string | undefined = appMeta.staff_id ?? undefined;
  let clientId: string | undefined = appMeta.client_id ?? undefined;

  // Fallback: getUser() returns raw_app_meta_data, which may not carry the
  // custom claims (e.g. a user created without app_metadata). Resolve the role
  // from the database by the already-authenticated identity. Uses the service
  // client because the user's own JWT may lack the tenant_id needed for RLS.
  if (!tenantId || !role) {
    const admin = createServiceClient();
    const email = user.email ?? '';

    const { data: agent } = await admin
      .from('agents').select('tenant_id').eq('email', email).maybeSingle();

    if (agent) {
      tenantId = agent.tenant_id;
      role = 'agent';
      staffId = undefined;
      clientId = undefined;
    } else {
      const { data: staff } = await admin
        .from('staff').select('id, tenant_id').eq('id', user.id).maybeSingle();

      if (staff) {
        tenantId = staff.tenant_id;
        role = 'staff';
        staffId = staff.id;
      } else {
        const { data: client } = await admin
          .from('clients').select('id, tenant_id').eq('email', email).maybeSingle();

        if (client) {
          tenantId = client.tenant_id;
          role = 'client';
          clientId = client.id;
        }
      }
    }
  }

  if (!tenantId || !role) return null;

  return {
    id: user.id,
    email: user.email ?? '',
    role,
    tenantId,
    staffId,
    clientId,
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
