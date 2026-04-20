/**
 * 📜 Phase 1 CDC dual-write dedup (pure)
 *
 * Collapses the `(source: 'service', source: 'cdc')` pair that
 * `entity_audit_trail` receives for every write during the Phase 1
 * rollout window. Extracted from `entity-audit-client.service.ts` so the
 * logic can be unit tested without pulling in the Firebase client SDK.
 *
 * Strategy:
 *   - Group by `(entityId, action)` implicitly.
 *   - For every CDC entry, drop any service-layer (or legacy,
 *     `source === undefined`) entry within `DUAL_WRITE_DEDUP_WINDOW_MS`.
 *   - CDC wins because it carries the full automatic deep diff and the
 *     same authenticated `performedBy` (once every writer stamps
 *     `_lastModifiedBy` — Phase 2 plan).
 *
 * @module services/audit/dedup-dual-write
 * @enterprise ADR-195 — Entity Audit Trail (Phase 1 CDC PoC)
 */

import type { EntityAuditEntry } from '@/types/audit-trail';

/**
 * Dedup window: comfortably larger than observed Cloud Function latency
 * (<5s in production telemetry) while small enough not to swallow
 * unrelated writes on the same entity.
 */
export const DUAL_WRITE_DEDUP_WINDOW_MS = 30_000;

/**
 * Collapse service+cdc dual-write pairs.
 *
 * Pure function. Input order is preserved for surviving entries.
 */
export function dedupDualWrite(
  entries: EntityAuditEntry[],
): EntityAuditEntry[] {
  const cdcEntries = entries.filter((e) => e.source === 'cdc');
  if (cdcEntries.length === 0) return entries;

  const supersededIds = new Set<string>();

  for (const cdc of cdcEntries) {
    const cdcMs = Date.parse(cdc.timestamp);
    if (!Number.isFinite(cdcMs)) continue;

    for (const candidate of entries) {
      if (candidate === cdc) continue;
      if (candidate.source === 'cdc') continue;
      if (candidate.entityId !== cdc.entityId) continue;
      if (candidate.action !== cdc.action) continue;
      if (!candidate.id) continue;

      const otherMs = Date.parse(candidate.timestamp);
      if (!Number.isFinite(otherMs)) continue;

      if (Math.abs(otherMs - cdcMs) <= DUAL_WRITE_DEDUP_WINDOW_MS) {
        supersededIds.add(candidate.id);
      }
    }
  }

  if (supersededIds.size === 0) return entries;
  return entries.filter((e) => !e.id || !supersededIds.has(e.id));
}
