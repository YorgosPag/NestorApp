/**
 * ADR-650 Milestone 2 — `RawTable` + `ColumnMapping` → `TopoPoint[]` (pure).
 *
 * Step 2 of the two-step import (see `topo-import-types`). This is the file that makes the
 * wizard a UX win over CASS, where the surveyor must physically REORDER the columns of the
 * file before it will load (§7 pain-point): here the file is never touched — the MAPPING
 * moves instead.
 *
 * Units: source values are scaled to canonical mm (ADR-462) via `TOPO_UNIT_SCALE_TO_MM`.
 * Numbers go through the `parseLocaleNumber` SSoT, so a Greek-locale export (`384512,345`)
 * parses exactly like the dot-decimal one.
 *
 * ⚠️ N=Northing=Y / E=Easting=X lives in `topo-order-presets` — never re-derived here.
 */

import { parseLocaleNumber } from '@/lib/number/locale-number';
import { TOPO_UNIT_SCALE_TO_MM, type ColumnMapping, type ColumnRole, type MappedPointsResult, type RawTable, type TopoUnit } from './topo-import-types';
import type { TopoPoint } from './topo-types';

/** Header keywords → role. Checked as substrings, longest-intent first (`pointId` before `x`). */
const HEADER_HINTS: ReadonlyArray<readonly [ColumnRole, readonly string[]]> = [
  ['pointId', ['point', 'σημείο', 'σημειο', 'pt', 'id', 'no', 'αα']],
  ['y', ['northing', 'north', 'βορ', 'ψ', 'y']],
  ['x', ['easting', 'east', 'ανατ', 'χ', 'x']],
  ['z', ['elevation', 'elev', 'height', 'υψόμετρο', 'υψομετρο', 'υψος', 'ύψος', 'z']],
  ['code', ['code', 'desc', 'κωδικ', 'περιγραφ']],
];

/** The three roles without which a row cannot become a point. */
const REQUIRED: readonly ColumnRole[] = ['x', 'y', 'z'];

/** True when every one of X/Y/Z is claimed by exactly one column. */
export function isMappingComplete(mapping: ColumnMapping): boolean {
  return REQUIRED.every((role) => mapping.filter((m) => m === role).length === 1);
}

/** The three column INDICES a bulk reader needs, resolved once instead of per line. */
export interface XyzColumns {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * `ColumnMapping` → the X/Y/Z column indices, or `null` when the mapping is absent/incomplete.
 *
 * ADR-650 M8β/Δ: the bulk cloud reader (`ascii-xyz-reader`) walks millions of lines and cannot
 * afford `mapping.indexOf(role)` per line, so it resolves the three indices ONCE through here —
 * the same mapping the wizard's table road interprets with `mapRowToPoint`. One mapping vocabulary,
 * two access patterns; never two vocabularies.
 */
export function resolveXyzColumns(mapping: ColumnMapping | undefined): XyzColumns | null {
  if (!mapping || !isMappingComplete(mapping)) return null;
  return { x: mapping.indexOf('x'), y: mapping.indexOf('y'), z: mapping.indexOf('z') };
}

/**
 * Best-effort role guess from header labels (the wizard pre-fills the dropdowns with it).
 * A label that matches nothing — or a role already taken — stays `ignore`, so the surveyor
 * is never silently given a wrong mapping; they just see an unset column.
 */
export function suggestMappingFromHeaders(headers: readonly string[]): ColumnMapping {
  const taken = new Set<ColumnRole>();
  return headers.map((header): ColumnRole => {
    const h = header.trim().toLowerCase();
    for (const [role, keywords] of HEADER_HINTS) {
      if (taken.has(role)) continue;
      if (keywords.some((k) => matchesHint(h, k))) {
        taken.add(role);
        return role;
      }
    }
    return 'ignore';
  });
}

/**
 * Short hints (`x`, `ψ`, `id`, `αα`) must match the WHOLE label — as substrings they
 * misfire catastrophically: «Υψόμετρο» contains «ψ», so a substring rule would map the
 * elevation column to Y whenever the file has no explicit Ψ column. Long hints
 * («northing», «υψόμετρο») stay substring so «Northing (m)» still resolves.
 */
function matchesHint(label: string, hint: string): boolean {
  return hint.length <= 2 ? label === hint : label.includes(hint);
}

/** First cell assigned to `role`, or `undefined` when the role is unmapped/out of range. */
function cellFor(row: readonly string[], mapping: ColumnMapping, role: ColumnRole): string | undefined {
  const idx = mapping.indexOf(role);
  return idx === -1 ? undefined : row[idx];
}

/**
 * One row → point, or `null` when any of X/Y/Z is missing or not a finite number.
 *
 * SSoT for «cells + roles → TopoPoint»: shared by the wizard (`applyColumnMapping`, table
 * source) and by the zero-config `parseTopoPoints` (lenient per-line source). The two differ
 * only in how they SPLIT their input — the interpretation of the split cells lives here once.
 */
export function mapRowToPoint(row: readonly string[], mapping: ColumnMapping, scale: number): TopoPoint | null {
  const x = parseLocaleNumber(cellFor(row, mapping, 'x') ?? '');
  const y = parseLocaleNumber(cellFor(row, mapping, 'y') ?? '');
  const z = parseLocaleNumber(cellFor(row, mapping, 'z') ?? '');
  if (x === null || y === null || z === null) return null;

  const code = (cellFor(row, mapping, 'code') ?? '').trim();
  // ADR-656 M10 — carry the surveyor's point number/name through (verbatim, no scaling): it
  // is an identifier, not a measurement. Was recognised by HEADER_HINTS but dropped until now.
  const pointNumber = (cellFor(row, mapping, 'pointId') ?? '').trim();
  return {
    x: x * scale,
    y: y * scale,
    z: z * scale,
    ...(code ? { code } : {}),
    ...(pointNumber ? { pointNumber } : {}),
  };
}

/**
 * Interpret every row of `table` through `mapping`, scaling from `unit` to canonical mm.
 * Rows that yield no finite X/Y/Z are reported in `skipped` (1-based, within `table.rows`)
 * rather than throwing — a survey file routinely ends with a stray total or a legend line.
 */
export function applyColumnMapping(
  table: RawTable,
  mapping: ColumnMapping,
  unit: TopoUnit = 'm',
): MappedPointsResult {
  const scale = TOPO_UNIT_SCALE_TO_MM[unit];
  const points: TopoPoint[] = [];
  const skipped: number[] = [];

  if (!isMappingComplete(mapping)) return { points, skipped };

  table.rows.forEach((row, i) => {
    const point = mapRowToPoint(row, mapping, scale);
    if (point) points.push(point);
    else skipped.push(i + 1);
  });

  return { points, skipped };
}
