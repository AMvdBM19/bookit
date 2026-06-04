import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_ROUTES = ['/login', '/auth/callback', '/change-password', '/setup', '/onboarding'];
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

  if (!user && !isPublicRoute) {
    const loginUrl = new URL(`/${slug}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && !isPublicRoute) {
    if (
      !tenant.wizard_completed &&
      !subPath.startsWith('/setup') &&
      !subPath.startsWith('/change-password') &&
      !subPath.startsWith('/staff-setup')
    ) {
      return NextResponse.redirect(new URL(`/${slug}/setup`, request.url));
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
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
