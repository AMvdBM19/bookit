import { NextRequest } from 'next/server';

const COOKIE_NAME = 'bookit_sa';

export function validateSuperAdminKey(request: NextRequest): boolean {
  const key = process.env.SUPER_ADMIN_API_KEY;
  if (!key) return false;

  const auth = request.headers.get('authorization') ?? '';
  if (auth === `Bearer ${key}`) return true;

  const cookieVal = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieVal === key) return true;

  return false;
}
