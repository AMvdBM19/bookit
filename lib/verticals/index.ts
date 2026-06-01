import type { VerticalConfig, VerticalId } from './types';
import { adultServicesConfig } from './adult-services';
import { tattooConfig } from './tattoo';

const VERTICAL_REGISTRY: Record<VerticalId, VerticalConfig> = {
  adult_services: adultServicesConfig,
  tattoo: tattooConfig,
};

export function getVerticalConfig(vertical: VerticalId): VerticalConfig {
  return VERTICAL_REGISTRY[vertical] ?? tattooConfig;
}

export function getAllVerticals(): VerticalConfig[] {
  return Object.values(VERTICAL_REGISTRY);
}

export function isValidVertical(value: unknown): value is VerticalId {
  return typeof value === 'string' && value in VERTICAL_REGISTRY;
}

export type { VerticalConfig, VerticalId };
export { adultServicesConfig, tattooConfig };
