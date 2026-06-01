'use client';

import { createContext, useContext } from 'react';
import type { VerticalConfig } from '@/lib/verticals/types';

const VerticalContext = createContext<VerticalConfig | null>(null);

export function VerticalProvider({
  config,
  children,
}: {
  config: VerticalConfig;
  children: React.ReactNode;
}) {
  return <VerticalContext.Provider value={config}>{children}</VerticalContext.Provider>;
}

export function useVertical(): VerticalConfig {
  const ctx = useContext(VerticalContext);
  if (!ctx) throw new Error('useVertical must be used within VerticalProvider');
  return ctx;
}
