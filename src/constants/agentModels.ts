export interface AgentModelOption {
  id: string;
  label: string;
  hint?: string;
}

export interface AgentModelGroup {
  label: string;
  models: AgentModelOption[];
}

export const AGENT_MODEL_GROUPS: AgentModelGroup[] = [
  {
    label: 'OpenAI · GPT-5.6',
    models: [
      { id: 'openai:gpt-5.6-sol', label: 'gpt-5.6-sol', hint: 'default · flagship reasoning' },
      { id: 'openai:gpt-5.6-terra', label: 'gpt-5.6-terra', hint: 'balanced everyday work' },
      { id: 'openai:gpt-5.6-luna', label: 'gpt-5.6-luna', hint: 'fast & cheap · high volume' },
    ],
  },
  {
    label: 'OpenAI · GPT-5 family (reasoning)',
    models: [
      { id: 'openai:gpt-5.4', label: 'gpt-5.4', hint: 'previous flagship' },
      {
        id: 'openai:gpt-5.4-mini',
        label: 'gpt-5.4-mini',
        hint: 'strong reasoning at lower cost · subagents / coding',
      },
      {
        id: 'openai:gpt-5.4-nano',
        label: 'gpt-5.4-nano',
        hint: 'cheapest 5.4 · high-volume / classification',
      },
      { id: 'openai:gpt-5', label: 'gpt-5', hint: 'previous flagship · solid all-rounder' },
      { id: 'openai:gpt-5-mini', label: 'gpt-5-mini', hint: 'fast & cheap reasoning' },
      { id: 'openai:gpt-5-nano', label: 'gpt-5-nano', hint: 'tiny / ultra-cheap chat' },
    ],
  },
  {
    label: 'OpenAI · GPT-4 family (chat)',
    models: [
      { id: 'openai:gpt-4.1', label: 'gpt-4.1', hint: 'general-purpose chat · large context' },
      { id: 'openai:gpt-4.1-mini', label: 'gpt-4.1-mini', hint: 'cheap & solid' },
      { id: 'openai:gpt-4.1-nano', label: 'gpt-4.1-nano', hint: 'cheapest 4.1 · short answers / routing' },
      { id: 'openai:gpt-4o-mini', label: 'gpt-4o-mini', hint: 'legacy multimodal mini · vision OK' },
    ],
  },
  {
    label: 'Google · Gemini 2.5 (stable)',
    models: [
      {
        id: 'google:gemini-2.5-pro',
        label: 'gemini-2.5-pro',
        hint: 'flagship · long context, reasoning, coding',
      },
      {
        id: 'google:gemini-2.5-flash',
        label: 'gemini-2.5-flash',
        hint: 'pragmatic default · fast, balanced',
      },
      {
        id: 'google:gemini-2.5-flash-lite',
        label: 'gemini-2.5-flash-lite',
        hint: 'cheapest stable · high-volume / latency-sensitive',
      },
    ],
  },
  {
    label: 'Google · Gemini 3 (preview)',
    models: [
      {
        id: 'google:gemini-3.1-pro-preview',
        label: 'gemini-3.1-pro-preview',
        hint: 'latest frontier · best Gemini reasoning',
      },
      {
        id: 'google:gemini-3-flash-preview',
        label: 'gemini-3-flash-preview',
        hint: 'next-gen flash · production-leaning preview',
      },
      {
        id: 'google:gemini-3.1-flash-lite-preview',
        label: 'gemini-3.1-flash-lite-preview',
        hint: 'preview · max throughput, lowest cost',
      },
    ],
  },
];

export const DEFAULT_AGENT_MODEL_ID = 'openai:gpt-5.6-sol';

export const ALL_AGENT_MODEL_IDS = AGENT_MODEL_GROUPS.flatMap((g) => g.models.map((m) => m.id));

export function shortModelLabel(modelId: string): string {
  const colon = modelId.indexOf(':');
  return colon >= 0 ? modelId.slice(colon + 1) : modelId;
}
