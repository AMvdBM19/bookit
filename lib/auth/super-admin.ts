import { NextRequest } from 'next/server';

export function validateSuperAdminKey(request: NextRequest): boolean {
  const key = process.env.SUPER_ADMIN_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${key}`;
}
