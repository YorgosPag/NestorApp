// /home/user/studio/src/app/api/communications/webhooks/telegram/message/rate-limit.ts

const userQueryCounts = new Map<string, { count: number; lastReset: number }>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxQueries = 15;

  if (!userQueryCounts.has(userId)) {
    userQueryCounts.set(userId, { count: 1, lastReset: now });
    return true;
  }

  const userStats = userQueryCounts.get(userId)!;
  
  if (now - userStats.lastReset > windowMs) {
    userStats.count = 1;
    userStats.lastReset = now;
    return true;
  }

  if (userStats.count < maxQueries) {
    userStats.count++;
    return true;
  }

  return false;
}
