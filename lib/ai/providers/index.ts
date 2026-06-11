import type { AIAdapter, AIProviderId } from '../adapter';

export class AIProviderNotImplementedError extends Error {
  constructor(provider: string) {
    super(`AI provider not yet implemented: ${provider}`);
    this.name = 'AIProviderNotImplementedError';
  }
}

/**
 * Resolve the adapter for a tenant's configured provider
 * (tenant_settings.ai_provider). Every provider currently throws —
 * the assistant endpoint surfaces this as 501.
 */
export function getAdapter(provider: AIProviderId): AIAdapter {
  switch (provider) {
    case 'anthropic':
    case 'openai':
    case 'mistral':
      throw new AIProviderNotImplementedError(provider);
    default: {
      const exhaustive: never = provider;
      throw new AIProviderNotImplementedError(String(exhaustive));
    }
  }
}
