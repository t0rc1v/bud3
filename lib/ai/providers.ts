import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel } from 'ai';
import { AVAILABLE_MODELS, type AIProvider, type ModelConfig } from './models';

export type { AIProvider, CapabilityTier, ModelConfig } from './models';

export function getModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER as AIProvider) || 'ai-gateway';
  
  switch (provider) {
    case 'openai':
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required when using OpenAI provider');
      }
      return openai(process.env.AI_MODEL || 'gpt-4.1-mini');
      
    case 'google':
      if (!process.env.GOOGLE_API_KEY) {
        throw new Error('GOOGLE_API_KEY is required when using Google provider');
      }
      return google(process.env.AI_MODEL || 'gemini-2.0-flash');
      
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is required when using Anthropic provider');
      }
      return anthropic(process.env.AI_MODEL || 'claude-3-5-sonnet-20241022');
      
    case 'ai-gateway':
    default:
      // Vercel AI Gateway - uses AI_GATEWAY_URL and AI_GATEWAY_API_KEY
      if (!process.env.AI_GATEWAY_URL) {
        throw new Error('AI_GATEWAY_URL is required when using AI Gateway provider');
      }
      if (!process.env.AI_GATEWAY_API_KEY) {
        throw new Error('AI_GATEWAY_API_KEY is required when using AI Gateway provider');
      }
      
      // For AI Gateway, create a custom anthropic provider with baseURL
      const gatewayProvider = createAnthropic({
        apiKey: process.env.AI_GATEWAY_API_KEY,
        baseURL: process.env.AI_GATEWAY_URL,
      });
      
      return gatewayProvider(process.env.AI_MODEL || 'claude-3-5-sonnet-20241022');
  }
}

export function getProviderDisplayName(): string {
  const provider = (process.env.AI_PROVIDER as AIProvider) || 'ai-gateway';
  
  switch (provider) {
    case 'openai':
      return 'OpenAI';
    case 'google':
      return 'Google AI';
    case 'anthropic':
      return 'Anthropic';
    case 'ai-gateway':
    default:
      return 'AI Gateway';
  }
}

export function getCurrentModelName(): string {
  const provider = (process.env.AI_PROVIDER as AIProvider) || 'ai-gateway';

  switch (provider) {
    case 'openai':
      return process.env.AI_MODEL || 'gpt-4o';
    case 'google':
      return process.env.AI_MODEL || 'gemini-2.0-flash';
    case 'anthropic':
      return process.env.AI_MODEL || 'claude-3-5-sonnet-20241022';
    case 'ai-gateway':
    default:
      return process.env.AI_MODEL || 'anthropic/claude-sonnet-4-5-20250514';
  }
}

export function getModelById(modelId: string): LanguageModel {
  const config = AVAILABLE_MODELS.find(m => m.id === modelId);
  if (!config) throw new Error(`Unknown model: ${modelId}`);
  switch (config.provider) {
    case 'openai':
      if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
      return openai(modelId);
    case 'google':
      if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY not set');
      return google(modelId);
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
      return anthropic(modelId);
    default:
      throw new Error(`Provider ${config.provider} not supported for model selection`);
  }
}

export function getAvailableModels(): ModelConfig[] {
  const provider = (process.env.AI_PROVIDER as AIProvider) || 'ai-gateway';
  if (provider === 'ai-gateway') return [];
  return AVAILABLE_MODELS.filter(m => {
    if (m.provider === 'openai')    return !!process.env.OPENAI_API_KEY;
    if (m.provider === 'google')    return !!process.env.GOOGLE_API_KEY;
    if (m.provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
    return false;
  });
}
