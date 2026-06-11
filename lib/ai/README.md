# lib/ai — Assistant Foundation

Skeleton for the tenant-facing AI assistant. **No provider is implemented
yet** — `POST /api/{slug}/assistant` returns 501 until one ships.

## Architecture

```
app/api/[slug]/assistant/route.ts   ← agent-only endpoint (403 if disabled, 501 now)
        │
        ▼
lib/ai/context/builder.ts           ← buildSystemPrompt(tenant, tab)
lib/ai/docs/loader.ts               ← loadDocsForTab(tab) reads ai-docs/*.md (PAGE_DOC_MAP)
        │
        ▼
lib/ai/providers/index.ts           ← getAdapter(provider) factory  ← tenant_settings.ai_provider
lib/ai/adapter.ts                   ← AIAdapter / AIMessage / AITool contracts
        │
        ▼
lib/ai/tools/index.ts               ← TOOL_REGISTRY (empty; planned catalog in
lib/ai/tools/types.ts                  ai-docs/tools-reference.md)
```

## Design decisions

- **Provider-agnostic**: `tenant_settings.ai_provider` ('anthropic' |
  'openai' | 'mistral') selects an adapter; all assistant logic talks to
  the `AIAdapter` interface only.
- **Docs-grounded**: the assistant's knowledge is the `ai-docs/` folder,
  loaded per dashboard tab so context stays small and relevant. Keep those
  docs current (AI Docs Maintenance Protocol in CLAUDE.md).
- **Gated twice**: the endpoint requires the `agent` role AND
  `tenant_settings.ai_assistant_enabled = true` (off by default, toggled
  per tenant by the platform operator).
- **Tools are opt-in and confirmation-gated**: `ToolDefinition.requiresConfirmation`
  forces an explicit user confirmation for write tools. Registry ships
  empty; tools must map 1:1 onto existing agent-scoped APIs so the
  assistant can never do more than the owner can.

## Implementing the first provider (future work)

1. Add `lib/ai/providers/anthropic.ts` implementing `AIAdapter.complete()`.
2. Return it from `getAdapter('anthropic')`.
3. Replace the 501 branch in the assistant route with the
   build-prompt → complete → (tool loop) → respond flow.
4. Add a chat UI surface in the agent dashboard.
