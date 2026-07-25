/**
 * ENTERPRISE ID — DETERMINISTIC COMPOSITE KEYS
 *
 * Pure, side-effect-free builders for the deterministic 1:1 (and 1:N) document
 * keys. Extracted from `enterprise-id-class.ts` (2026-07-25) under N.7.1 — same
 * move, same reason as `./enterprise-id-deterministic` (the pure seeded hash):
 * the class file owns *stateful* generation (uniqueness retry loop, cache,
 * stats) and nothing else.
 *
 * These are NOT id generators: they derive a key from data the caller already
 * holds, so calling one twice returns the same string by design (idempotency is
 * the point — it is what keeps `user_preferences/{docId}` a single blob per
 * (user, tenant) instead of an unbounded pile).
 *
 * ⚠️ Deliberately named `*Key`, not `generate*Id`: the `enterprise-id-convenience`
 * registry module reserves the `generate[A-Z]*Id` identifier shape for the sealed
 * SSoT set, and the distinction it draws is exactly the one drawn here (see its
 * description re: `id-generation.ts` — "different purpose"). The public
 * `generate*Id` surface stays on `EnterpriseIdService`, which delegates here, so
 * no consumer import changes.
 *
 * @module services/enterprise-id-composite-keys
 * @see ADR-017, ADR-210, ADR-294 — enterprise ID SSoT
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';

const P = ENTERPRISE_ID_PREFIXES;

export function aiUsageDocKey(channel: string, userId: string, month: string): string {
  return `${P.AI_USAGE}_${channel}_${userId}_${month}`;
}

/** Filters are sorted so that the same failing set maps to one key regardless of call order. */
export function queryStrategyDocKey(collection: string, failedFilters: string[]): string {
  const filterKey = [...failedFilters].sort().join('_');
  return `${P.QUERY_STRATEGY}_${collection}_${filterKey}`;
}

export function chatHistoryDocKey(channel: string, senderId: string): string {
  return `${P.AI_CHAT_HISTORY}_${channel}_${senderId}`;
}

/** ADR-235: Deterministic 1:1 key — one ownership table per project */
export function ownershipTableKey(projectId: string): string {
  return `${P.OWNERSHIP_TABLE}_${projectId}`;
}

/** ADR-235: Deterministic revision key — one revision per version */
export function ownershipRevisionKey(version: number): string {
  return `${P.OWNERSHIP_TABLE}_rev_v${version}`;
}

/**
 * UserSettings SSoT: deterministic 1:1 key — one preferences blob per
 * (user, tenant). Used by `user_preferences/{docId}` Firestore collection
 * and by `userSettingsRepository.bind(userId, companyId)`.
 */
export function userPreferencesKey(userId: string, companyId: string): string {
  if (!userId) throw new Error('userPreferencesKey: userId is required');
  if (!companyId) throw new Error('userPreferencesKey: companyId is required');
  return `${userId}_${companyId}`;
}

/**
 * ADR-327 §6: Deterministic vendor-logo file key — one logo claim per quote.
 * Replaces the legacy literal `'vendor-logo'` shared-claim id which produced
 * a single mutable Firestore doc serving N quotes (race-prone).
 */
export function vendorLogoFileKey(quoteId: string): string {
  return `${P.VENDOR_LOGO}_${quoteId}`;
}
