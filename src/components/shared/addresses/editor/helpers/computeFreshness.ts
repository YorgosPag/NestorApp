/**
 * =============================================================================
 * computeFreshness — pure helper (ADR-332 §3.10 / Phase 8)
 * =============================================================================
 *
 * Maps a stored `verifiedAt` timestamp into the discriminated `AddressFreshness`
 * value consumed by `<AddressFreshnessIndicator>`. Pure function — no React,
 * no `Date.now()` inside the conversion (clock injectable for determinism).
 *
 * Thresholds match Google freshness tiers used by enterprise CRM/ERP
 * verticals (Salesforce Maps, HubSpot, Pipedrive):
 *
 *   age = now − verifiedAt
 *   < 24h         → fresh
 *   24h .. 7d     → recent
 *   7d  .. 30d    → aging   (staleReason: time-elapsed)
 *   > 30d         → stale   (staleReason: time-elapsed)
 *
 * `null` / `undefined` `verifiedAt` → `never`.
 *
 * @module components/shared/addresses/editor/helpers/computeFreshness
 * @see ADR-332 §3.10 Read-only mode enrichment
 */

import type { AddressFreshness } from '../types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

/**
 * Convert a stored verification timestamp into a render-ready freshness chip.
 * `nowMs` is injectable to keep callers/tests deterministic.
 */
export function computeFreshness(
  verifiedAt: number | null | undefined,
  nowMs: number = Date.now(),
): AddressFreshness {
  if (verifiedAt == null) {
    return { verifiedAt: null, level: 'never' };
  }
  const age = nowMs - verifiedAt;
  if (age < ONE_DAY_MS) {
    return { verifiedAt, level: 'fresh' };
  }
  if (age < ONE_WEEK_MS) {
    return { verifiedAt, level: 'recent' };
  }
  if (age < ONE_MONTH_MS) {
    return { verifiedAt, level: 'aging', staleReason: 'time-elapsed' };
  }
  return { verifiedAt, level: 'stale', staleReason: 'time-elapsed' };
}
