import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel } from 'ai';

export type AIProvider = 'openai' | 'google' | 'anthropic' | 'ai-gateway';

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
