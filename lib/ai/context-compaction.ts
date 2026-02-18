/**
 * Context Compaction System
 * 
 * Implements tiered context compaction to manage large conversation histories:
 * 
 * Tier 1: Remove detailed tool call inputs from older messages
 * Tier 2: Summarize message groups when context exceeds threshold
 * Tier 3: Sliding window - keep first 2 + last N messages when near limit
 * 
 * Context Window: 1M tokens
 * Warning Threshold: 800K tokens
 * Compaction Threshold: 500K tokens
 */

import { getTokenCache } from './token-cache';
import type { UIMessage, TextUIPart, ToolUIPart } from 'ai';

interface CompactionResult {
  messages: UIMessage[];
  removedCount: number;
  action: 'none' | 'individual-truncated' | 'tool-inputs' | 'summarized' | 'sliding-window';
  summary?: string;
}

interface CompactionOptions {
  maxTokens?: number;
  warningThreshold?: number;
  compactionThreshold?: number;
  preserveRecentCount?: number;
  preserveFirstCount?: number;
}

const DEFAULT_OPTIONS: Required<CompactionOptions> = {
  maxTokens: 1000000, // 1M tokens
  warningThreshold: 800000, // 800K tokens
  compactionThreshold: 500000, // 500K tokens
  preserveRecentCount: 20,
  preserveFirstCount: 2,
};

// Maximum size for individual messages to prevent single message from dominating context
const MAX_SINGLE_MESSAGE_TOKENS = 100000; // 100K tokens per message
const LARGE_MESSAGE_COMPACTION_THRESHOLD = 50000; // 50K tokens - start compacting individual messages

/**
 * Extract text content from a message part
 */
function getTextFromPart(part: UIMessage['parts'][number]): string {
  if (part.type === 'text') {
    return (part as TextUIPart).text || '';
  }
  return '';
}

/**
 * Calculate total tokens for a message
 */
function calculateMessageTokens(message: UIMessage): number {
  const cache = getTokenCache();
  let totalTokens = 0;

  // Sum tokens from all parts
  if (Array.isArray(message.parts)) {
    message.parts.forEach(part => {
      const text = getTextFromPart(part);
      totalTokens += cache.estimateTokens(text);
    });
  }

  // Add overhead for role and metadata
  totalTokens += 4; // Approximate overhead per message

  return totalTokens;
}

/**
 * Calculate total tokens for an array of messages
 */
function calculateTotalTokens(messages: UIMessage[]): number {
  return messages.reduce((sum, msg) => sum + calculateMessageTokens(msg), 0);
}

/**
 * Compact individual large messages that exceed the threshold
 * For messages >50K tokens, we truncate or summarize them
 */
function compactLargeIndividualMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => {
    const msgTokens = calculateMessageTokens(msg);
    
    // If message is within limits, keep it as is
    if (msgTokens <= LARGE_MESSAGE_COMPACTION_THRESHOLD) {
      return msg;
    }
    
    // Clone message to avoid mutation
    const compactedMsg = { ...msg };
    
    // For very large messages, we need to truncate content
    if (Array.isArray(compactedMsg.parts)) {
      compactedMsg.parts = compactedMsg.parts.map((part) => {
        if (part.type === 'text') {
          const textPart = part as TextUIPart;
          const text = textPart.text || '';
          const estimatedTokens = getTokenCache().estimateTokens(text);
          
          // If this text part is very large, truncate it
          if (estimatedTokens > LARGE_MESSAGE_COMPACTION_THRESHOLD) {
            // Calculate max characters (approx 4 chars per token)
            const maxChars = LARGE_MESSAGE_COMPACTION_THRESHOLD * 4;
            const truncatedText = text.slice(0, maxChars);
            const removedTokens = estimatedTokens - LARGE_MESSAGE_COMPACTION_THRESHOLD;
            
            return {
              ...textPart,
              text: truncatedText + `\n\n[Message truncated: ${removedTokens.toLocaleString()} tokens removed to stay within context limits. Original message was ${estimatedTokens.toLocaleString()} tokens.]`,
            } as TextUIPart;
          }
        }
        return part;
      });
    }
    
    return compactedMsg;
  });
}

/**
 * Check if the first N messages are collectively too large
 * This handles the edge case where system/initial messages dominate context
 */
function checkFirstMessagesSize(messages: UIMessage[], preserveFirstCount: number): {
  firstMessagesTooLarge: boolean;
  firstMessagesTotalTokens: number;
} {
  if (messages.length <= preserveFirstCount) {
    return { firstMessagesTooLarge: false, firstMessagesTotalTokens: 0 };
  }
  
  const firstMessages = messages.slice(0, preserveFirstCount);
  const firstMessagesTotalTokens = calculateTotalTokens(firstMessages);
  
  // If first messages exceed 40% of warning threshold, they're too large
  const threshold = DEFAULT_OPTIONS.warningThreshold * 0.4;
  
  return {
    firstMessagesTooLarge: firstMessagesTotalTokens > threshold,
    firstMessagesTotalTokens,
  };
}

/**
 * Tier 1: Remove detailed tool call inputs from older messages
 * Keeps tool outputs and results, removes the detailed input parameters
 */
function compactToolInputs(messages: UIMessage[]): UIMessage[] {
  const cutoffIndex = Math.max(0, messages.length - 5); // Keep recent 5 untouched

  return messages.map((msg, index) => {
    if (index >= cutoffIndex || msg.role !== 'assistant') {
      return msg;
    }

    // Clone message to avoid mutation
    const compactedMsg = { ...msg };

    // Remove detailed tool inputs from parts
    if (Array.isArray(compactedMsg.parts)) {
      compactedMsg.parts = compactedMsg.parts.map((part) => {
        if (part.type.startsWith('tool-')) {
          // Keep the tool part but remove detailed input
          const toolPart = part as ToolUIPart;
          return {
            ...toolPart,
            input: '[compact: input removed to save context]',
          } as UIMessage['parts'][number];
        }
        return part;
      });
    }

    return compactedMsg;
  });
}

/**
 * Tier 2: Summarize older message groups
 * Creates a summary of messages between preserved first and recent messages
 */
function summarizeMessages(messages: UIMessage[]): { messages: UIMessage[]; summary: string } {
  if (messages.length <= 10) {
    return { messages, summary: '' };
  }

  // Keep first 2 and last 15, summarize middle
  const firstCount = 2;
  const lastCount = 15;
  const middleMessages = messages.slice(firstCount, messages.length - lastCount);

  if (middleMessages.length === 0) {
    return { messages, summary: '' };
  }

  // Generate summary text from middle messages
  const summaryPoints = middleMessages
    .filter(msg => msg.role === 'assistant')
    .slice(0, 5) // Take first 5 assistant messages as key points
    .map(msg => {
      // Extract text from message parts
      const text = msg.parts
        ?.filter((p): p is TextUIPart => p.type === 'text')
        .map((p: TextUIPart) => p.text || '')
        .join(' ') || '';
      
      // Truncate to first sentence or 100 chars
      const firstSentence = text.split(/[.!?]/, 1)[0];
      return firstSentence.length > 100 
        ? firstSentence.slice(0, 100) + '...' 
        : firstSentence;
    })
    .filter(text => text.length > 10);

  const summary = summaryPoints.length > 0
    ? `Previous conversation summary: ${summaryPoints.join('; ')}`
    : '[Previous messages summarized to save context space]';

  // Create summary message
  const summaryMessage: UIMessage = {
    id: `summary-${Date.now()}`,
    role: 'assistant',
    parts: [{ type: 'text', text: summary }],
  };

  return {
    messages: [
      ...messages.slice(0, firstCount),
      summaryMessage,
      ...messages.slice(messages.length - lastCount),
    ],
    summary,
  };
}

/**
 * Tier 3: Sliding window - keep only first and last messages
 * Most aggressive compaction when approaching the limit
 */
function slidingWindowCompact(messages: UIMessage[], preserveFirstCount: number, preserveRecentCount: number): UIMessage[] {
  if (messages.length <= preserveFirstCount + preserveRecentCount) {
    return messages;
  }

  // Keep first N and last N messages
  const firstMessages = messages.slice(0, preserveFirstCount);
  const lastMessages = messages.slice(-preserveRecentCount);

  // Create a summary message for what was removed
  const removedCount = messages.length - preserveFirstCount - preserveRecentCount;
  const summaryText = `[${removedCount} messages removed to stay within context limits. Key context preserved: first ${preserveFirstCount} messages and last ${preserveRecentCount} messages.]`;

  const summaryMessage: UIMessage = {
    id: `compact-${Date.now()}`,
    role: 'assistant',
    parts: [{ type: 'text', text: summaryText }],
  };

  return [...firstMessages, summaryMessage, ...lastMessages];
}

/**
 * Main compaction function
 * Applies tiered compaction based on context size
 * 
 * Compaction Order:
 * 1. Individual message size check - truncate messages >50K tokens
 * 2. First messages size check - ensure initial messages don't dominate
 * 3. Tool input removal from older messages
 * 4. Middle message summarization
 * 5. Sliding window (aggressive)
 */
export function compactContext(
  messages: UIMessage[],
  options: CompactionOptions = {}
): CompactionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (messages.length === 0) {
    return { messages, removedCount: 0, action: 'none' };
  }

  // STEP 1: Check individual message sizes
  // Compact any messages that exceed the single message threshold
  let compactedMessages = compactLargeIndividualMessages(messages);
  let individualCompactionApplied = compactedMessages !== messages;
  let tokensAfterCompaction = calculateTotalTokens(compactedMessages);
  
  // STEP 2: Check if first messages are collectively too large
  // This handles edge case where system/initial context is massive
  const firstMessagesCheck = checkFirstMessagesSize(compactedMessages, opts.preserveFirstCount);
  if (firstMessagesCheck.firstMessagesTooLarge) {
    console.warn(`[Context Compaction] First ${opts.preserveFirstCount} messages are ${firstMessagesCheck.firstMessagesTotalTokens.toLocaleString()} tokens (40%+ of warning threshold). Consider reducing initial context size.`);
    
    // If first messages are too large, we may need to be more aggressive
    // Reduce preserveFirstCount to 1 to save space
    if (opts.preserveFirstCount > 1 && compactedMessages.length > 3) {
      const preservedFirst = compactedMessages.slice(0, 1);
      const remaining = compactedMessages.slice(1);
      const noteMessage: UIMessage = {
        id: `note-${Date.now()}`,
        role: 'assistant',
        parts: [{ type: 'text', text: `[Initial context reduced: First message exceeds size limits.]` }],
      };
      compactedMessages = [preservedFirst[0], noteMessage, ...remaining];
      tokensAfterCompaction = calculateTotalTokens(compactedMessages);
    }
  }
  
  // Tier 0: No further compaction needed
  if (tokensAfterCompaction < opts.compactionThreshold) {
    return { 
      messages: compactedMessages, 
      removedCount: messages.length - compactedMessages.length,
      action: individualCompactionApplied ? 'individual-truncated' : 'none',
    };
  }

  // Tier 1: Remove tool inputs from older messages
  compactedMessages = compactToolInputs(compactedMessages);
  tokensAfterCompaction = calculateTotalTokens(compactedMessages);

  if (tokensAfterCompaction < opts.compactionThreshold) {
    return {
      messages: compactedMessages,
      removedCount: messages.length - compactedMessages.length,
      action: 'tool-inputs',
    };
  }

  // Tier 2: Summarize middle messages
  const summaryResult = summarizeMessages(compactedMessages);
  compactedMessages = summaryResult.messages;
  tokensAfterCompaction = calculateTotalTokens(compactedMessages);

  if (tokensAfterCompaction < opts.warningThreshold) {
    return {
      messages: compactedMessages,
      removedCount: messages.length - compactedMessages.length,
      action: 'summarized',
      summary: summaryResult.summary,
    };
  }

  // Tier 3: Sliding window (most aggressive)
  compactedMessages = slidingWindowCompact(
    compactedMessages,
    opts.preserveFirstCount,
    opts.preserveRecentCount
  );

  return {
    messages: compactedMessages,
    removedCount: messages.length - compactedMessages.length,
    action: 'sliding-window',
    summary: summaryResult.summary,
  };
}

/**
 * Check if context compaction is needed
 */
export function needsCompaction(messages: UIMessage[], warningThreshold = 800000): boolean {
  if (messages.length === 0) return false;
  const tokens = calculateTotalTokens(messages);
  return tokens >= warningThreshold;
}

/**
 * Get statistics for individual messages
 */
export function getMessageStats(messages: UIMessage[]): {
  largestMessageTokens: number;
  largestMessageIndex: number;
  oversizedMessageCount: number;
  firstMessagesTotalTokens: number;
} {
  let largestMessageTokens = 0;
  let largestMessageIndex = -1;
  let oversizedMessageCount = 0;
  
  messages.forEach((msg, index) => {
    const tokens = calculateMessageTokens(msg);
    if (tokens > largestMessageTokens) {
      largestMessageTokens = tokens;
      largestMessageIndex = index;
    }
    if (tokens > LARGE_MESSAGE_COMPACTION_THRESHOLD) {
      oversizedMessageCount++;
    }
  });
  
  const firstMessages = messages.slice(0, DEFAULT_OPTIONS.preserveFirstCount);
  const firstMessagesTotalTokens = calculateTotalTokens(firstMessages);
  
  return {
    largestMessageTokens,
    largestMessageIndex,
    oversizedMessageCount,
    firstMessagesTotalTokens,
  };
}

/**
 * Get context statistics
 */
export function getContextStats(messages: UIMessage[]): {
  messageCount: number;
  estimatedTokens: number;
  warningThreshold: number;
  maxTokens: number;
  percentUsed: number;
  largestMessageTokens: number;
  largestMessageIndex: number;
  oversizedMessageCount: number;
  firstMessagesTotalTokens: number;
} {
  const tokens = calculateTotalTokens(messages);
  const maxTokens = DEFAULT_OPTIONS.maxTokens;
  const messageStats = getMessageStats(messages);
  
  return {
    messageCount: messages.length,
    estimatedTokens: tokens,
    warningThreshold: DEFAULT_OPTIONS.warningThreshold,
    maxTokens,
    percentUsed: Math.round((tokens / maxTokens) * 100),
    ...messageStats,
  };
}

/**
 * Pre-flight check before sending to API
 * Returns true if safe to proceed, false if needs compaction
 */
export function checkContextBeforeSend(
  messages: UIMessage[],
  newMessage?: UIMessage,
  maxTokens = 1000000
): { canSend: boolean; needsCompaction: boolean; estimatedTokens: number } {
  const currentTokens = calculateTotalTokens(messages);
  const newMessageTokens = newMessage ? calculateMessageTokens(newMessage) : 0;
  const totalTokens = currentTokens + newMessageTokens;

  return {
    canSend: totalTokens < maxTokens,
    needsCompaction: totalTokens > DEFAULT_OPTIONS.warningThreshold,
    estimatedTokens: totalTokens,
  };
}
