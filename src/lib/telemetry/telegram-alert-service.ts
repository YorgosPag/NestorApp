import { nowISO } from '@/lib/date-local';

/**
 * =============================================================================
 * TELEGRAM ALERT SERVICE — Production Error Monitoring
 * =============================================================================
 *
 * Sends instant Telegram alerts to the Super Admin when server-side errors occur.
 * Integrates with the canonical Logger via TelegramAlertOutput.
 *
 * FEATURES:
 * - Rate limiting: 10 alerts/hour, 50 alerts/day
 * - Deduplication: 5-min cooldown per unique error fingerprint
 * - Graceful failure: NEVER throws, NEVER blocks the caller
 * - Production-only: No alerts in development
 *
 * @module lib/telemetry/telegram-alert-service
 * @enterprise Production Error Monitoring
 */

// ============================================================================
// TYPES
// ============================================================================

type AlertLevel = 'error' | 'client-error' | 'slow';

interface AlertMetadata {
  url?: string;
  userEmail?: string;
  stack?: string;
  [key: string]: unknown;
}

// ============================================================================
// RATE LIMITING STATE (in-memory, per serverless instance)
// ============================================================================

interface RateLimitState {
  hourlyCount: number;
  hourlyResetAt: number;
  dailyCount: number;
  dailyResetAt: number;
  /** Fingerprint → last alert timestamp (for dedup cooldown) */
  recentFingerprints: Map<string, number>;
}

const LIMITS = {
  MAX_PER_HOUR: 10,
  MAX_PER_DAY: 50,
  DEDUP_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes
} as const;

const state: RateLimitState = {
  hourlyCount: 0,
  hourlyResetAt: Date.now() + 3_600_000,
  dailyCount: 0,
  dailyResetAt: Date.now() + 86_400_000,
  recentFingerprints: new Map(),
};

// ============================================================================
// FINGERPRINT & RATE LIMIT
// ============================================================================

function createFingerprint(module: string, message: string): string {
  return `${module}::${message.substring(0, 100)}`;
}

function isRateLimited(fingerprint: string): boolean {
  const now = Date.now();

  // Reset hourly counter
  if (now > state.hourlyResetAt) {
    state.hourlyCount = 0;
    state.hourlyResetAt = now + 3_600_000;
  }

  // Reset daily counter
  if (now > state.dailyResetAt) {
    state.dailyCount = 0;
    state.dailyResetAt = now + 86_400_000;
  }

  // Check hourly/daily limits
  if (state.hourlyCount >= LIMITS.MAX_PER_HOUR) return true;
  if (state.dailyCount >= LIMITS.MAX_PER_DAY) return true;

  // Check dedup cooldown
  const lastSent = state.recentFingerprints.get(fingerprint);
  if (lastSent && now - lastSent < LIMITS.DEDUP_COOLDOWN_MS) return true;

  return false;
}

function recordAlert(fingerprint: string): void {
  const now = Date.now();
  state.hourlyCount++;
  state.dailyCount++;
  state.recentFingerprints.set(fingerprint, now);

  // Prune old fingerprints (keep map bounded)
  if (state.recentFingerprints.size > 200) {
    const cutoff = now - LIMITS.DEDUP_COOLDOWN_MS;
    for (const [key, ts] of state.recentFingerprints) {
      if (ts < cutoff) state.recentFingerprints.delete(key);
    }
  }
}

// ============================================================================
// MESSAGE FORMATTING
// ============================================================================

function formatAlertMessage(
  level: AlertLevel,
  module: string,
  message: string,
  metadata?: AlertMetadata
): string {
  const emojiMap: Record<AlertLevel, string> = {
    'error': '\u{1F6A8}',        // siren
    'client-error': '\u{1F534}', // red circle
    'slow': '\u{1F422}',         // turtle
  };
  const labelMap: Record<AlertLevel, string> = {
    'error': 'ERROR',
    'client-error': 'CLIENT ERROR',
    'slow': 'SLOW',
  };
  const emoji = emojiMap[level];
  const label = labelMap[level];
  const timestamp = nowISO().replace('T', ' ').substring(0, 19) + ' UTC';

  const lines: string[] = [
    `${emoji} ${label} \u2014 ${module}`,
    `\u{1F4CD} ${message.substring(0, 200)}`,
  ];

  if (metadata?.stack) {
    const shortStack = metadata.stack.split('\n').slice(0, 2).join('\n');
    lines.push(`\u274C ${shortStack.substring(0, 150)}`);
  }

  if (metadata?.url) {
    lines.push(`\u{1F310} ${metadata.url}`);
  }

  if (metadata?.userEmail) {
    lines.push(`\u{1F464} ${metadata.userEmail}`);
  }

  // Show relevant metadata fields (error details, IDs, etc.)
  if (metadata) {
    const skipKeys = new Set(['stack', 'url', 'userEmail', 'test']);
    const details = Object.entries(metadata)
      .filter(([k, v]) => !skipKeys.has(k) && v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}: ${String(v).substring(0, 100)}`)
      .slice(0, 5);
    if (details.length > 0) {
      lines.push(`\u{1F4CB} ${details.join(' | ')}`);
    }
  }

  lines.push(`\u{1F550} ${timestamp}`);

  return lines.join('\n');
}

// ============================================================================
// CORE FUNCTION
// ============================================================================

/**
 * Send a Telegram alert to the Super Admin.
 *
 * - Rate-limited (10/hr, 50/day, 5min dedup cooldown)
 * - NEVER throws — safe to call fire-and-forget
 * - Production-only (no-op in development)
 */
export async function sendTelegramAlert(
  level: AlertLevel,
  module: string,
  message: string,
  metadata?: AlertMetadata
): Promise<void> {
  try {
    // No alerts in development
    if (process.env.NODE_ENV !== 'production') return;

    const fingerprint = createFingerprint(module, message);
    if (isRateLimited(fingerprint)) return;

    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '5618410820';
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    const text = formatAlertMessage(level, module, message, metadata);

    // Direct fetch to avoid circular imports with telegram-service
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: undefined }),
    });

    if (response.ok) {
      recordAlert(fingerprint);
    }
  } catch {
    // Swallow all errors — alerting must NEVER break the application
  }
}

// ============================================================================
// PERFORMANCE TRACKING
// ============================================================================

const SLOW_THRESHOLD_MS = 5000; // 5 seconds

/**
 * Track API route performance. Call at start of handler, returns end() function.
 * If duration exceeds threshold, sends a Telegram slow alert.
 *
 * @example
 * ```typescript
 * const endTrack = trackApiPerformance('ProjectsRoute', '/api/projects');
 * // ... handler logic ...
 * endTrack(); // Sends alert if > 5s
 * ```
 */
export function trackApiPerformance(
  module: string,
  route: string,
  thresholdMs: number = SLOW_THRESHOLD_MS
): () => void {
  const start = Date.now();

  return () => {
    const duration = Date.now() - start;
    if (duration >= thresholdMs) {
      void sendTelegramAlert('slow', module, `${route} — ${(duration / 1000).toFixed(1)}s`, {
        route,
        duration: `${duration}ms`,
        threshold: `${thresholdMs}ms`,
      });
    }
  };
}
