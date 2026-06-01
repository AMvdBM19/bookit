'use client';

import { createContext, useContext } from 'react';
import type { TenantContext } from '@/lib/types/auth';

const TenantCtx = createContext<TenantContext | null>(null);

export function TenantProvider({
  context,
  children,
}: {
  context: TenantContext;
  children: React.ReactNode;
}) {
  return <TenantCtx.Provider value={context}>{children}</TenantCtx.Provider>;
}

export function useTenant(): TenantContext {
  const ctx = useContext(TenantCtx);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
