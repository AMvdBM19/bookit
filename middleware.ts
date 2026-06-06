import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Routes always reachable without authentication. Setup is intentionally NOT
// here: it requires an authenticated agent, so unauthenticated hits redirect to
// login (preventing the login↔setup redirect loop on new tenants).
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/change-password'];
const BYPASS_PREFIXES = ['/api', '/book'];
const SYSTEM_SLUGS = ['super-admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Super admin API and booking widget bypass tenant middleware
  for (const prefix of BYPASS_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.next();
    }
  }

  const segments = pathname.split('/').filter(Boolean);
  const slug = segments[0];

  // Root path — handled by app/page.tsx (BUG 6 FIX)
  if (!slug) {
    return NextResponse.next();
  }

  // System slugs (e.g. super-admin) — not tenants, skip tenant resolution
  if (SYSTEM_SLUGS.includes(slug)) {
    return NextResponse.next();
  }

  const tenant = await resolveTenantSlug(slug);

  if (!tenant) {
    return NextResponse.rewrite(new URL('/not-found', request.url));
  }

  if (!tenant.is_active) {
    return new NextResponse('This account is inactive.', { status: 403 });
  }

  const { user, response } = await updateSession(request);

  const subPath = '/' + segments.slice(1).join('/');
  const isPublicRoute = PUBLIC_ROUTES.some(r => subPath === r || subPath.startsWith(r + '/'));

  // Unauthenticated on a protected route → bounce to login (login itself is public).
  if (!user && !isPublicRoute) {
    const loginUrl = new URL(`/${slug}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on a non-public route: verify they belong to this tenant.
  // The user's tenant (set by the custom_access_token_hook under app_metadata,
  // with a DB fallback) must match the tenant resolved from the URL slug. This
  // prevents cross-tenant access where a user authenticated for tenant A browses
  // /tenant-b/dashboard.
  if (user && !isPublicRoute) {
    const userTenantId = await resolveUserTenantId(user);

    if (userTenantId && userTenantId !== tenant.id) {
      // Authenticated, but for a different tenant. Redirect to their own tenant's
      // equivalent page rather than leaking this tenant's shell.
      const userTenantSlug = await resolveSlugById(userTenantId);
      if (userTenantSlug) {
        const targetPath = subPath === '/' ? '/dashboard' : subPath;
        return NextResponse.redirect(new URL(`/${userTenantSlug}${targetPath}`, request.url));
      }
      // Cannot resolve their tenant slug → send to this tenant's login.
      return NextResponse.redirect(new URL(`/${slug}/login`, request.url));
    }
  }

  // Authenticated on a protected route → enforce the wizard gate both ways.
  if (user && !isPublicRoute) {
    const onSetup = subPath === '/setup' || subPath.startsWith('/setup/');

    // Wizard not finished → force into setup (setup/staff-setup are themselves exempt).
    if (
      !tenant.wizard_completed &&
      !onSetup &&
      !subPath.startsWith('/staff-setup')
    ) {
      return NextResponse.redirect(new URL(`/${slug}/setup`, request.url));
    }

    // Wizard finished but still on setup → send to dashboard.
    if (tenant.wizard_completed && onSetup) {
      return NextResponse.redirect(new URL(`/${slug}/dashboard`, request.url));
    }
  }

  response.headers.set('x-tenant-id', tenant.id);
  response.headers.set('x-tenant-slug', slug);
  response.headers.set('x-tenant-vertical', tenant.vertical);
  response.headers.set('x-tenant-client-mode', tenant.client_mode);

  return response;
}

async function resolveTenantSlug(slug: string): Promise<{
  id: string;
  slug: string;
  vertical: string;
  client_mode: string;
  is_active: boolean;
  wizard_completed: boolean;
} | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return null;

    const url = `${supabaseUrl}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id,slug,vertical,client_mode,is_active,wizard_completed&limit=1`;

    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      next: { revalidate: 5 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

// Resolve the authenticated user's own tenant id. Fast path reads the claim the
// custom_access_token_hook injects under app_metadata; the DB fallback mirrors
// lib/auth/session.ts, because getUser() surfaces raw_app_meta_data which may not
// carry that claim (e.g. seeded demo agents). Without the fallback the cross-tenant
// check would silently no-op for those users.
async function resolveUserTenantId(user: {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const claim =
    (user.app_metadata?.tenant_id as string | undefined) ??
    (user.user_metadata?.tenant_id as string | undefined);
  if (claim) return claim;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const email = user.email ?? '';

  async function lookup(path: string): Promise<string | null> {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        headers,
        next: { revalidate: 5 },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.[0]?.tenant_id ?? null;
    } catch {
      return null;
    }
  }

  if (email) {
    const agentTenant = await lookup(
      `agents?email=eq.${encodeURIComponent(email)}&select=tenant_id&limit=1`
    );
    if (agentTenant) return agentTenant;
  }

  const staffTenant = await lookup(
    `staff?id=eq.${encodeURIComponent(user.id)}&select=tenant_id&limit=1`
  );
  if (staffTenant) return staffTenant;

  if (email) {
    const clientTenant = await lookup(
      `clients?email=eq.${encodeURIComponent(email)}&select=tenant_id&limit=1`
    );
    if (clientTenant) return clientTenant;
  }

  return null;
}

async function resolveSlugById(tenantId: string): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return null;

    const url = `${supabaseUrl}/rest/v1/tenants?id=eq.${encodeURIComponent(tenantId)}&select=slug&limit=1`;

    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0]?.slug ?? null;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
