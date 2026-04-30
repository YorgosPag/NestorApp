/**
 * Quote expiration helpers — derived state, never auto-status-flip.
 * @see ADR-328 §5.BB
 */

import type { Quote } from '../types/quote';

const EXPIRING_SOON_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/** Resolves validUntil to milliseconds. Returns null if absent or malformed. */
function resolveMs(quote: Quote): number | null {
  const v = quote.validUntil;
  if (!v) return null;
  // Firestore Timestamp shape
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return (v as { seconds: number }).seconds * 1000;
  }
  // Fallback: ISO string (malformed Firestore write)
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    if (!isNaN(ms)) return ms;
    console.warn('[quote-expiration] malformed validUntil:', v);
    return null;
  }
  return null;
}

/** True when validUntil is set and in the past. */
export function isExpired(quote: Quote, now = Date.now()): boolean {
  const ms = resolveMs(quote);
  return ms !== null && ms < now;
}

/**
 * Days until expiry (positive = future, negative = past).
 * Returns null when validUntil is absent.
 */
export function daysUntilExpiry(quote: Quote, now = Date.now()): number | null {
  const ms = resolveMs(quote);
  if (ms === null) return null;
  return Math.floor((ms - now) / MS_PER_DAY);
}

export type ExpiryBadgeState = 'expired' | 'expiring_soon' | 'normal' | 'unknown';

/** Derives the badge/banner state for a quote. */
export function expiryBadgeState(quote: Quote, now = Date.now()): ExpiryBadgeState {
  const ms = resolveMs(quote);
  if (ms === null) return 'unknown';
  const msLeft = ms - now;
  if (msLeft < 0) return 'expired';
  if (msLeft < EXPIRING_SOON_DAYS * MS_PER_DAY) return 'expiring_soon';
  return 'normal';
}

/** Formats validUntil as locale date string (el-GR). Empty string if absent. */
export function formatValidUntilDate(quote: Quote): string {
  const ms = resolveMs(quote);
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('el-GR');
}
