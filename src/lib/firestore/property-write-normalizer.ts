/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Write Normalizer (SSoT write-time invariants)
 * =============================================================================
 *
 * Single server-side authority that enforces the property data-integrity
 * invariants on EVERY write path (create route + PATCH route). Revit / Yardi /
 * SAP RE-FX grade: data is made consistent at the write boundary, not patched
 * after the fact by readers.
 *
 * Invariants enforced (all idempotent — calling twice = same result):
 *  1. **Status SSoT mirror** — legacy `status` ALWAYS equals canonical
 *     `commercialStatus`. New units default to `unavailable` (never `reserved`).
 *  2. **Multi-level levelData seed** — every declared level has a full level-data
 *     object (zeroed schema, never `{}`); orphan keys dropped.
 *  3. **Aggregation** — top-level `areas` / `layout` / `orientations` are summed
 *     from the (seeded) per-level data.
 *  4. **Legacy flat-area derivation** — legacy `area` mirrors `areas.gross`.
 *
 * @module lib/firestore/property-write-normalizer
 * @see ADR-145 — Property Types SSoT
 * @see ADR-197 — Sales Pages (single disposition field)
 * @see ADR-236 — Multi-Level Property Management
 * @see ADR-287 — Enum SSoT Centralization
 */

import 'server-only';

import {
  DEFAULT_COMMERCIAL_STATUS,
  deriveLegacyStatusFromCommercial,
} from '@/constants/commercial-statuses';
import {
  aggregateLevelData,
  buildSeededLevelData,
} from '@/services/multi-level.service';
import type { LevelData, PropertyLevel } from '@/types/property';

// =============================================================================
// TYPES
// =============================================================================

export interface NormalizePropertyWriteOptions {
  /** `create` applies the commercialStatus default; `update` is patch-only. */
  readonly mode: 'create' | 'update';
  /** Existing Firestore document (update path) for fall-through resolution. */
  readonly existing?: Record<string, unknown> | null;
}

// =============================================================================
// INVARIANT 1 — Status SSoT mirror
// =============================================================================

/**
 * Keep `commercialStatus` (SSoT) and legacy `status` consistent at the write
 * boundary — **bidirectional**, so a legacy-only caller (older flows that still
 * set `status`) self-heals the canonical `commercialStatus`, and vice-versa.
 * On `create`, applies {@link DEFAULT_COMMERCIAL_STATUS} when neither provided.
 */
function applyStatusMirror(
  payload: Record<string, unknown>,
  { mode, existing }: NormalizePropertyWriteOptions,
): void {
  // Forward (primary): caller set the canonical commercialStatus.
  if (payload.commercialStatus !== undefined && payload.commercialStatus !== null) {
    const canonical = deriveLegacyStatusFromCommercial(payload.commercialStatus);
    payload.commercialStatus = canonical;
    payload.status = canonical;
    return;
  }

  // Reverse (heal): legacy-only caller set `status` → derive the SSoT from it.
  if (payload.status !== undefined && payload.status !== null) {
    const canonical = deriveLegacyStatusFromCommercial(payload.status);
    payload.commercialStatus = canonical;
    payload.status = canonical;
    return;
  }

  if (mode === 'create') {
    const canonical =
      existing?.commercialStatus != null
        ? deriveLegacyStatusFromCommercial(existing.commercialStatus)
        : DEFAULT_COMMERCIAL_STATUS;
    payload.commercialStatus = canonical;
    payload.status = canonical;
  }
  // update without any status field → leave both untouched.
}

// =============================================================================
// INVARIANT 2 + 3 — Multi-level seed + aggregation
// =============================================================================

/**
 * Seed `levelData` for every declared level, then aggregate per-level totals
 * into top-level `areas` / `layout` / `orientations`. No-op for single-level.
 *
 * Aggregation is applied ONLY when the per-level data carries real content.
 * At creation, a multi-level unit often arrives with declared levels but no
 * per-level data yet (the user enters unit-level totals first, fills levels
 * later) — in that case we still seed the empty per-level schema (fix for the
 * empty-`{}` bug) but must NOT clobber the client-provided totals with zeros.
 */
function applyMultiLevelSeedAndAggregation(
  payload: Record<string, unknown>,
  { existing }: NormalizePropertyWriteOptions,
): void {
  const levels = (payload.levels ?? existing?.levels) as
    | PropertyLevel[]
    | undefined;
  if (!Array.isArray(levels) || levels.length < 2) return;

  const currentLevelData = (payload.levelData ?? existing?.levelData) as
    | Record<string, LevelData>
    | undefined;

  const seeded = buildSeededLevelData(levels, currentLevelData);
  payload.levelData = seeded;

  const aggregated = aggregateLevelData(seeded);
  if (!hasAggregatedContent(aggregated)) return;

  payload.areas = aggregated.areas;
  payload.layout = aggregated.layout;
  payload.orientations = aggregated.orientations;
}

/** True when aggregation produced any non-zero measurement / count / orientation. */
function hasAggregatedContent(
  aggregated: ReturnType<typeof aggregateLevelData>,
): boolean {
  const { areas, layout, orientations } = aggregated;
  const anyArea = Object.values(areas).some((v) => v > 0);
  const anyLayout = Object.values(layout).some((v) => v > 0);
  return anyArea || anyLayout || orientations.length > 0;
}

// =============================================================================
// INVARIANT 4 — Legacy flat-area derivation
// =============================================================================

/** Derive the legacy flat `area` field from the SSoT `areas.gross`. */
function applyLegacyFlatAreaDerivation(
  payload: Record<string, unknown>,
  { existing }: NormalizePropertyWriteOptions,
): void {
  const areas = (payload.areas ?? existing?.areas) as
    | { gross?: number }
    | undefined;
  const gross = areas?.gross;
  if (typeof gross === 'number' && Number.isFinite(gross) && gross > 0) {
    payload.area = gross;
  }
}

// =============================================================================
// PUBLIC — Orchestrator
// =============================================================================

/**
 * Apply all property write-time SSoT invariants to `payload` in-place.
 * Pure with respect to `existing` (never mutates it). Safe to call on both
 * create and update paths.
 */
export function normalizePropertyWritePayload(
  payload: Record<string, unknown>,
  options: NormalizePropertyWriteOptions,
): void {
  applyStatusMirror(payload, options);
  applyMultiLevelSeedAndAggregation(payload, options);
  applyLegacyFlatAreaDerivation(payload, options);
}
