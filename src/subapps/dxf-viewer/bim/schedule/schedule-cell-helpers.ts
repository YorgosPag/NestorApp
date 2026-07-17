/**
 * BIM Schedule Export — Cell Primitives (ADR-363 §6 Phase 8).
 *
 * Shared value-coercion helpers + the identity-header cells every per-type
 * mapper opens with. Split out of `schedule-preset-mappers.ts` so the mapping
 * file stays under the 500-line SRP ceiling (N.7.1) and so these primitives
 * have one home instead of a per-mapper header clone (N.18 / jscpd, ADR-583).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import type { ScheduleCellValue, ScheduleLookups, ScheduleRow } from './types';

// ─── Value coercion ──────────────────────────────────────────────────────────

/** Numeric cell — non-finite / non-number collapses to null (blank cell). */
export function safeNumber(value: unknown): ScheduleCellValue {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Text cell — empty / non-string collapses to null (blank cell). */
export function safeText(value: unknown): ScheduleCellValue {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Strip the enterprise-id prefix and clamp to 12 chars for compact display. */
export function shortId(rawId: string | null | undefined): string {
  if (!rawId) return '';
  return rawId.replace(/^[a-z]+-?[a-z]*_/, '').slice(0, 12);
}

// ─── Structural identity header (shared by every per-type mapper) ────────────

/** Minimal shape the identity cells read — every BIM entity satisfies it. */
interface EntityHeaderShape {
  readonly id: string;
  readonly floorId: string;
  readonly kind: string;
  readonly buildingId?: string;
}

/**
 * The identity triple — id + localised floor + translated kind — that every
 * per-type mapper opens with. Extracted so the mappers don't each carry a
 * byte-identical header clone (N.18 / jscpd, ADR-583).
 */
export function mapIdentityCells(entity: EntityHeaderShape, lookups: ScheduleLookups): ScheduleRow['cells'] {
  return {
    id: entity.id,
    floor: lookups.floor(entity.floorId),
    kind: lookups.translateKind ? lookups.translateKind(entity.kind) : entity.kind,
  };
}

/**
 * Identity cells PLUS the BOQ group-by-building name (ADR-369 §9.2 Q2.4). Used
 * by the load-bearing presets (wall/slab/column/beam/foundation + combined);
 * stair + slab-opening carry no buildingName column and use `mapIdentityCells`.
 */
export function mapBuildingHeaderCells(entity: EntityHeaderShape, lookups: ScheduleLookups): ScheduleRow['cells'] {
  return {
    ...mapIdentityCells(entity, lookups),
    buildingName: lookups.building?.(entity.buildingId)?.name ?? null,
  };
}
