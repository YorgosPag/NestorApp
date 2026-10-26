/**
 * ADR-920 Β4.8 Β3.5 — the breakline INVENTORY: what the «Ασυνέχειες επιφάνειας» list shows, derived — never stored.
 *
 * Civil 3D Prospector › Definition › Breaklines + the «Crossing Breaklines» vista, from data that already exists:
 *   - the DEFINITION (`TopoPointStore` breaklines per surface) — rows, #n numbering, z-source, vertices, Z range;
 *   - the ONE triangulation's report (`getTopoBuildReport().breaklineConflicts`) — the conflict pairs, flagged by the
 *     SAME `breaklineConflictFlag` as the QA report (same ranking, same message, same severity bands, same #n);
 *   - the current scene's entity ids — link health: does the drawing line a breakline was picked from still exist?
 *     (Civil 3D keeps the last shape silently when the source goes; we keep it AND say so — `topo-source-cascade`.)
 *
 * Pure — zero React/DOM/store: the caller passes the reports and the id set, so the whole derivation is testable and
 * there is no second `buildTin`. `null` scene ids ⇒ link `null` («cannot tell»), never a false «missing».
 *
 * @module systems/topography/topo-breakline-inventory
 */

import type {
  Breakline, BreaklineElevationConflict, BreaklineElevationSource, LocalOrigin, TopoSurfaceId,
} from './topo-types';
import { TOPO_SURFACE_IDS } from './topo-types';
import type { TopoQaFlag } from './qa/topo-qa-types';
import {
  breaklineConflictFlag, breaklineLabelsOf, rankBreaklineConflicts,
} from './qa/check-breakline-conflicts';
import { calculatePolylineLength } from '../../rendering/entities/shared/geometry-polyline-utils';

/** `none` = not picked from a drawing line (e.g. an approved automatic candidate). */
export type BreaklineLinkHealth = 'live' | 'missing' | 'none';

/** Provenance of the z, with the honest fourth answer for breaklines saved before provenance existed. */
export type BreaklineZSource = BreaklineElevationSource | 'unknown';

export interface BreaklineInventoryRow {
  readonly breakline: Breakline;
  readonly surfaceId: TopoSurfaceId;
  /** 1-based #n — the same number the QA messages use. */
  readonly label: string | number;
  readonly source: BreaklineZSource;
  readonly closed: boolean;
  readonly vertexCount: number;
  /** Plan length (canonical mm). */
  readonly lengthMm: number;
  /** WORLD elevation range (canonical mm); `null` when no vertex carries a finite z. */
  readonly zRangeMm: { readonly min: number; readonly max: number } | null;
  /** `null` = no scene to ask (cannot tell). */
  readonly link: BreaklineLinkHealth | null;
  /** How many conflicts this breakline is part of, either side of the pair. */
  readonly conflictCount: number;
}

export interface BreaklineConflictRow {
  readonly flag: TopoQaFlag;
  readonly surfaceId: TopoSurfaceId;
  /** The breakline that was bent to agree — the one the list highlights. */
  readonly overruledBreaklineId: string;
  /** The other half of the pair; `null` when a survey point held the kept elevation. */
  readonly keptBreaklineId: string | null;
}

export interface BreaklineInventory {
  readonly rows: readonly BreaklineInventoryRow[];
  /** Largest Δz first within each surface (the QA order). */
  readonly conflicts: readonly BreaklineConflictRow[];
}

/** One surface's inputs: its definition breaklines + its build report's conflicts and LOCAL origin. */
export interface BreaklineSurfaceInput {
  readonly breaklines: readonly Breakline[];
  readonly conflicts: readonly BreaklineElevationConflict[];
  readonly origin: LocalOrigin;
}

export interface BreaklineInventoryInput {
  readonly surfaces: Readonly<Record<TopoSurfaceId, BreaklineSurfaceInput>>;
  readonly sceneEntityIds: ReadonlySet<string> | null;
}

function zRangeOf(breakline: Breakline): BreaklineInventoryRow['zRangeMm'] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of breakline.vertices) {
    if (!Number.isFinite(v.z)) continue;
    min = Math.min(min, v.z);
    max = Math.max(max, v.z);
  }
  return min <= max ? { min, max } : null;
}

function linkOf(breakline: Breakline, sceneEntityIds: ReadonlySet<string> | null): BreaklineLinkHealth | null {
  if (!breakline.sourceEntityId) return 'none';
  if (!sceneEntityIds) return null;
  return sceneEntityIds.has(breakline.sourceEntityId) ? 'live' : 'missing';
}

function conflictCountsOf(conflicts: readonly BreaklineElevationConflict[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const bump = (id: string | undefined): void => { if (id) counts.set(id, (counts.get(id) ?? 0) + 1); };
  for (const c of conflicts) {
    bump(c.overruledBreaklineId);
    if (c.keptBreaklineId !== c.overruledBreaklineId) bump(c.keptBreaklineId);
  }
  return counts;
}

function surfaceRows(
  surfaceId: TopoSurfaceId,
  input: BreaklineSurfaceInput,
  sceneEntityIds: ReadonlySet<string> | null,
): BreaklineInventoryRow[] {
  const labelOf = breaklineLabelsOf(input.breaklines);
  const counts = conflictCountsOf(input.conflicts);
  return input.breaklines.map((breakline) => {
    const closed = breakline.closed ?? false;
    return {
      breakline,
      surfaceId,
      label: labelOf(breakline.id),
      source: breakline.elevationSource ?? 'unknown',
      closed,
      vertexCount: breakline.vertices.length,
      lengthMm: calculatePolylineLength(breakline.vertices.map((v) => ({ x: v.x, y: v.y })), closed),
      zRangeMm: zRangeOf(breakline),
      link: linkOf(breakline, sceneEntityIds),
      conflictCount: counts.get(breakline.id) ?? 0,
    };
  });
}

function surfaceConflicts(surfaceId: TopoSurfaceId, input: BreaklineSurfaceInput): BreaklineConflictRow[] {
  const labelOf = breaklineLabelsOf(input.breaklines);
  return rankBreaklineConflicts(input.conflicts).map((ranked) => ({
    flag: breaklineConflictFlag(ranked, labelOf, input.origin),
    surfaceId,
    overruledBreaklineId: ranked.conflict.overruledBreaklineId,
    keptBreaklineId: ranked.conflict.keptBreaklineId ?? null,
  }));
}

/** Every surface (`TOPO_SURFACE_IDS` order), rows in definition order, conflicts largest Δz first. */
export function buildBreaklineInventory(input: BreaklineInventoryInput): BreaklineInventory {
  return {
    rows: TOPO_SURFACE_IDS.flatMap((id) => surfaceRows(id, input.surfaces[id], input.sceneEntityIds)),
    conflicts: TOPO_SURFACE_IDS.flatMap((id) => surfaceConflicts(id, input.surfaces[id])),
  };
}
