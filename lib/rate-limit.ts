import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const defaultConfig: RateLimitConfig = {
  maxRequests: 5, // 5 requests
  windowMs: 60 * 1000, // per minute
};

/**
 * Rate limiting middleware for API routes
 * @param identifier - Unique identifier (e.g., userId + route, or IP + route)
 * @param config - Rate limit configuration
 * @returns Object with isAllowed boolean and headers
 */
export function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {}
): { isAllowed: boolean; headers: Record<string, string> } {
  const { maxRequests, windowMs } = { ...defaultConfig, ...config };
  const now = Date.now();
  
  const entry = rateLimitStore.get(identifier);
  
  // If no entry or window has passed, create new entry
  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(identifier, newEntry);
    
    return {
      isAllowed: true,
      headers: {
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': String(maxRequests - 1),
        'X-RateLimit-Reset': String(Math.ceil(newEntry.resetTime / 1000)),
      },
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    return {
      isAllowed: false,
      headers: {
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(entry.resetTime / 1000)),
        'Retry-After': String(Math.ceil((entry.resetTime - now) / 1000)),
      },
    };
  }
  
  // Increment counter
  entry.count += 1;
  rateLimitStore.set(identifier, entry);
  
  return {
    isAllowed: true,
    headers: {
      'X-RateLimit-Limit': String(maxRequests),
      'X-RateLimit-Remaining': String(maxRequests - entry.count),
      'X-RateLimit-Reset': String(Math.ceil(entry.resetTime / 1000)),
    },
  };
}

/**
 * Higher-order function to wrap API routes with rate limiting
 */
export function withRateLimit(
  handler: (req: Request) => Promise<NextResponse>,
  config: Partial<RateLimitConfig> = {}
) {
  return async (req: Request): Promise<NextResponse> => {
    // Get user identifier from request
    const userId = req.headers.get('x-user-id') || 'anonymous';
    const route = new URL(req.url).pathname;
    const identifier = `${userId}:${route}`;
    
    const result = checkRateLimit(identifier, config);
    
    if (!result.isAllowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { 
          status: 429,
          headers: result.headers,
        }
      );
    }
    
    const response = await handler(req);
    
    // Add rate limit headers to response
    Object.entries(result.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  };
}

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
