import type { VerticalConfig, VerticalId } from './types';
import { adultServicesConfig } from './adult-services';
import { tattooConfig } from './tattoo';

const registry: Record<VerticalId, VerticalConfig> = {
  adult_services: adultServicesConfig,
  tattoo: tattooConfig,
};

export function getVerticalConfig(vertical: VerticalId): VerticalConfig {
  const config = registry[vertical];
  if (!config) {
    throw new Error(`Unknown vertical: ${vertical}`);
  }
  return config;
}

export function getAllVerticals(): VerticalConfig[] {
  return Object.values(registry);
}

export function isValidVertical(value: unknown): value is VerticalId {
  return typeof value === 'string' && value in registry;
}

export type { VerticalConfig, VerticalId };
export { adultServicesConfig, tattooConfig };
