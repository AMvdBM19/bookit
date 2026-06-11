import type { AITool } from '../adapter';

/** Everything a tool execution is allowed to know about the caller. */
export interface ToolContext {
  tenantId: string;
  slug: string;
  /** The authenticated agent driving the assistant session. */
  userId: string;
}

export interface ToolResult {
  ok: boolean;
  /** JSON-serializable payload returned to the model. */
  data?: unknown;
  /** Human-readable error when ok === false. */
  error?: string;
}

export interface ToolDefinition {
  /** Wire schema advertised to the model. */
  spec: AITool;
  /**
   * Write tools require explicit user confirmation in the chat UI before
   * execute() runs; read tools do not.
   */
  requiresConfirmation: boolean;
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
