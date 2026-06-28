const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

type Entry = {
  count: number;
  resetAt: number;
};

const requestLog = new Map<string, Entry>();

export function enforceRateLimit(key: string) {
  const now = Date.now();
  const current = requestLog.get(key);

  if (!current || current.resetAt <= now) {
    requestLog.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return { allowed: true };
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false };
  }

  current.count += 1;
  return { allowed: true };
}

export const RATE_LIMITS = {
  WINDOW_MS,
  MAX_REQUESTS_PER_WINDOW,
};
