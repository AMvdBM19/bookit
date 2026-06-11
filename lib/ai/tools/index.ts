import type { AITool } from '../adapter';
import type { ToolDefinition } from './types';

export type { ToolDefinition, ToolContext, ToolResult } from './types';

export type ToolRegistry = Record<string, ToolDefinition>;

/**
 * Registry of assistant tools, keyed by tool name. Intentionally empty —
 * the planned catalog lives in ai-docs/tools-reference.md and tools are
 * added here as they ship.
 */
export const TOOL_REGISTRY: ToolRegistry = {};

/** Wire specs for every registered tool, for the adapter request. */
export function getToolSpecs(): AITool[] {
  return Object.values(TOOL_REGISTRY).map(t => t.spec);
}

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY[name];
}
