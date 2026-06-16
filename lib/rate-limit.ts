import type { RateLimitResult } from './types';

let _rateLimiters: {
  anon: import('@upstash/ratelimit').Ratelimit;
  authed: import('@upstash/ratelimit').Ratelimit;
} | null = null;
let _warned = false;

function getUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

async function getLimiters() {
  if (_rateLimiters) return _rateLimiters;
  if (!getUrl()) {
    if (!_warned) {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL not set — rate limiting disabled (fail-open)',
      );
      _warned = true;
    }
    return null;
  }
  const { Ratelimit } = await import('@upstash/ratelimit');
  const { Redis } = await import('@upstash/redis');
  const redis = Redis.fromEnv();
  _rateLimiters = {
    anon: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      prefix: 'crn:anon',
    }),
    authed: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 d'),
      prefix: 'crn:user',
    }),
  };
  return _rateLimiters;
}

export async function checkRateLimit(
  identifier: string,
  isAuthenticated: boolean,
): Promise<RateLimitResult> {
  const limiters = await getLimiters();
  if (!limiters) return { success: true, remaining: -1, reset: 0 };

  const limiter = isAuthenticated ? limiters.authed : limiters.anon;
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}
