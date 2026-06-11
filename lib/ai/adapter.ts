// Provider-agnostic AI adapter contract. Concrete adapters (Anthropic,
// OpenAI, Mistral) implement AIAdapter; the rest of the assistant code
// only ever talks to this interface.

export type AIRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  role: AIRole;
  content: string;
  /** Set when role === 'tool': which tool call this message answers. */
  tool_call_id?: string;
}

export interface AITool {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. */
  input_schema: Record<string, unknown>;
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AICompletionRequest {
  system: string;
  messages: AIMessage[];
  tools?: AITool[];
  max_tokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  /** Assistant text, empty string when the turn is tool calls only. */
  text: string;
  tool_calls: AIToolCall[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'error';
  usage?: { input_tokens: number; output_tokens: number };
}

export interface AIAdapter {
  readonly provider: AIProviderId;
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}

/** Mirrors the tenant_settings.ai_provider CHECK constraint. */
export type AIProviderId = 'anthropic' | 'openai' | 'mistral';
