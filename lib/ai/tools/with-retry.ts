import type { Tool } from 'ai';
import { classifyError } from './error-classification';

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wrap an async execute function with automatic retry for transient errors.
 */
export function withRetry<TArgs extends unknown[], TResult>(
  executeFn: (...args: TArgs) => Promise<TResult>,
  options?: RetryOptions
): (...args: TArgs) => Promise<TResult> {
  const maxRetries = options?.maxRetries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 500;

  return async (...args: TArgs): Promise<TResult> => {
    let lastError: unknown;
    let lastResult: TResult | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await executeFn(...args);

        // Check for { success: false, error: "..." } return shape
        if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as Record<string, unknown>).success === false
        ) {
          const errorMsg = String(
            (result as Record<string, unknown>).error || 'Unknown error'
          );
          const category = classifyError(errorMsg);

          lastResult = result;

          const shouldRetry =
            category === 'transient' ||
            (category === 'unknown' && attempt === 0);

          if (shouldRetry && attempt < maxRetries) {
            if (process.env.NODE_ENV === 'development') {
              console.log(
                `[withRetry] Retrying (attempt ${attempt + 1}/${maxRetries}) — ${category}: ${errorMsg}`
              );
            }
            await sleep(baseDelayMs * Math.pow(2, attempt));
            continue;
          }

          return result;
        }

        // Successful result
        return result;
      } catch (err) {
        lastError = err;
        const errorMsg =
          err instanceof Error ? err.message : String(err);
        const category = classifyError(errorMsg);

        const shouldRetry =
          category === 'transient' ||
          (category === 'unknown' && attempt === 0);

        if (shouldRetry && attempt < maxRetries) {
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[withRetry] Retrying (attempt ${attempt + 1}/${maxRetries}) — ${category}: ${errorMsg}`
            );
          }
          await sleep(baseDelayMs * Math.pow(2, attempt));
          continue;
        }

        throw err;
      }
    }

    // Should not reach here, but return last result or throw last error
    if (lastResult !== undefined) return lastResult;
    throw lastError;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

/**
 * Wrap a Vercel AI SDK tool object with retry logic on its execute function.
 */
export function wrapToolWithRetry(
  tool: AnyTool,
  options?: RetryOptions
): AnyTool {
  if (!tool.execute) return tool;

  return {
    ...tool,
    execute: withRetry(tool.execute, options),
  };
}
