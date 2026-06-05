'use client';

import { createContext, useContext, ReactNode } from 'react';
import type { Terminology, FeatureFlags, ComplianceFlags } from '@/lib/types/tenant-config';
import { DEFAULT_TERMINOLOGY, DEFAULT_FEATURE_FLAGS, DEFAULT_COMPLIANCE_FLAGS } from '@/lib/types/tenant-config';

interface TenantConfigContextValue {
  terminology: Terminology;
  featureFlags: FeatureFlags;
  complianceFlags: ComplianceFlags;
  sourceTemplateSlug: string | null;
}

const TenantConfigContext = createContext<TenantConfigContextValue | null>(null);

interface TenantConfigProviderProps {
  children: ReactNode;
  terminology: Terminology;
  featureFlags: FeatureFlags;
  complianceFlags: ComplianceFlags;
  sourceTemplateSlug: string | null;
}

export function TenantConfigProvider({
  children,
  terminology,
  featureFlags,
  complianceFlags,
  sourceTemplateSlug,
}: TenantConfigProviderProps) {
  return (
    <TenantConfigContext.Provider value={{ terminology, featureFlags, complianceFlags, sourceTemplateSlug }}>
      {children}
    </TenantConfigContext.Provider>
  );
}

export function useTenantConfig(): TenantConfigContextValue {
  const ctx = useContext(TenantConfigContext);
  if (!ctx) {
    return {
      terminology: DEFAULT_TERMINOLOGY,
      featureFlags: DEFAULT_FEATURE_FLAGS,
      complianceFlags: DEFAULT_COMPLIANCE_FLAGS,
      sourceTemplateSlug: null,
    };
  }
  return ctx;
}
