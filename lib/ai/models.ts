export type AIProvider = 'openai' | 'google' | 'anthropic' | 'ai-gateway';
export type CapabilityTier = 'fast' | 'balanced' | 'powerful' | 'thinking';

export interface ModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  tier: CapabilityTier;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  // OpenAI
  { id: 'gpt-4.1',             name: 'GPT-4.1',             provider: 'openai',     description: 'Most capable GPT-4.1',               tier: 'powerful'  },
  { id: 'gpt-4.1-mini',        name: 'GPT-4.1 Mini',        provider: 'openai',     description: 'Fast, cost-efficient GPT-4.1',       tier: 'fast'      },
  { id: 'gpt-4o',              name: 'GPT-4o',              provider: 'openai',     description: 'Multimodal, strong reasoning',       tier: 'balanced'  },
  { id: 'o4-mini',             name: 'o4-mini',             provider: 'openai',     description: 'OpenAI reasoning model',             tier: 'fast'      },
  // Google
  { id: 'gemini-2.5-pro',         name: 'Gemini 2.5 Pro',      provider: 'google', description: "Google's most capable model",    tier: 'powerful'  },
  { id: 'gemini-2.0-flash',       name: 'Gemini 2.0 Flash',    provider: 'google', description: 'Fast and capable',               tier: 'balanced'  },
  { id: 'gemini-2.0-flash-lite',  name: 'Gemini Flash Lite',   provider: 'google', description: 'Lightest, fastest Gemini',       tier: 'fast'      },
  // Anthropic
  { id: 'claude-opus-4-5-20251101',   name: 'Claude Opus 4.5',   provider: 'anthropic', description: 'Most intelligent Claude',    tier: 'powerful'  },
  { id: 'claude-sonnet-4-5-20251001', name: 'Claude Sonnet 4.5', provider: 'anthropic', description: 'Balanced performance',       tier: 'balanced'  },
  { id: 'claude-haiku-4-5-20251001',  name: 'Claude Haiku 4.5',  provider: 'anthropic', description: 'Fastest Claude model',       tier: 'fast'      },
  // DeepSeek (via AI Gateway)
  { id: 'deepseek/deepseek-r1',       name: 'DeepSeek R1',       provider: 'ai-gateway', description: 'DeepSeek thinking/reasoning model', tier: 'thinking' },
];
