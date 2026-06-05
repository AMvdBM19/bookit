import type { VerticalId, ClientMode } from '@/lib/types/tenant-config';

export type UserRole = 'agent' | 'staff' | 'client' | 'super_admin';

export interface JWTClaims {
  tenant_id: string;
  user_role: UserRole;
  staff_id?: string;
  client_id?: string;
}

export interface TenantContext {
  tenantId: string;
  slug: string;
  name: string;
  vertical: VerticalId;
  clientMode: ClientMode;
  isActive: boolean;
  wizardCompleted: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  staffId?: string;
  clientId?: string;
}
