/**
 * Generic linear-member snap-target collector — pure SSoT (ADR-508 unified linear-member framing).
 *
 * Μαζεύει από τη σκηνή τους face-snap στόχους για το ghost-before-click ΚΑΘΕ γραμμικού
 * εργαλείου (δοκάρι/τοίχος):
 *   · **Κολόνες** → footprint πολύγωνα (12-θέσεων face snap + flush) — ΠΑΝΤΑ.
 *   · **Γραμμικά μέλη** (δοκάρια/τοίχοι, ανά `memberKinds`) → `{ axis, outline }` για το
 *     member-to-member Τ-framing.
 *
 * Το δοκάρι έχει έτοιμο κλειστό `geometry.outline`· ο τοίχος ΟΧΙ → χτίζουμε κλειστό δακτύλιο
 * από `outerEdge` + αντεστραμμένο `innerEdge` (επαρκές για `projectPolygonOnAxis` extents +
 * `coveredIntervals` coverage). Pure: ΙΔΙΑ δεδομένα που διαβάζει το commit path από το store
 * (preview === commit).
 *
 * @see ./linear-member-face-snap.ts — LinearMemberSnapTarget consumer
 * @see ../../hooks/drawing/beam-preview-helpers.ts — collectBeamSnapTargets (delegate)
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { closedRingFromEdges } from '../geometry/shared/polygon-utils';
import type { LinearMemberSnapTarget } from './linear-member-face-snap';

/** Είδος γραμμικού μέλους που μπορεί να γίνει face-snap στόχος. */
export type MemberSnapKind = 'beam' | 'wall';

export interface MemberSnapTargets {
  /** Column footprints (world-baked 2Δ πολύγωνα). */
  readonly footprints: Point2D[][];
  /** Γραμμικά μέλη ως {axis, outline}. */
  readonly memberTargets: LinearMemberSnapTarget[];
}

export interface CollectMemberSnapTargetsOptions {
  /** Ποια γραμμικά μέλη μπαίνουν στους στόχους (οι κολόνες πάντα). */
  readonly memberKinds: readonly MemberSnapKind[];
  /** Προαιρετικό id προς αποκλεισμό (π.χ. το μέλος υπό επεξεργασία). */
  readonly excludeId?: string;
}

type Pts = readonly { readonly x: number; readonly y: number }[];

function toPoint2D(pts: Pts): Point2D[] {
  return pts.map((v) => ({ x: v.x, y: v.y }));
}

/** Beam outline (έτοιμο κλειστό footprint). */
function beamTarget(e: Entity): LinearMemberSnapTarget | null {
  const g = (e as {
    geometry?: {
      axisPolyline?: { points?: Pts };
      outline?: { vertices?: Pts };
    };
  }).geometry;
  const axis = g?.axisPolyline?.points;
  const outline = g?.outline?.vertices;
  if (axis && axis.length >= 2 && outline && outline.length >= 3) {
    return { id: e.id, axis: toPoint2D(axis), outline: toPoint2D(outline) };
  }
  return null;
}

/** Wall outline = outerEdge + αντεστραμμένο innerEdge (κλειστός δακτύλιος). */
function wallTarget(e: Entity): LinearMemberSnapTarget | null {
  const g = (e as {
    geometry?: {
      axisPolyline?: { points?: Pts };
      outerEdge?: { points?: Pts };
      innerEdge?: { points?: Pts };
    };
  }).geometry;
  const axis = g?.axisPolyline?.points;
  const outer = g?.outerEdge?.points;
  const inner = g?.innerEdge?.points;
  if (!axis || axis.length < 2 || !outer || outer.length < 2 || !inner || inner.length < 2) return null;
  // SSoT `closedRingFromEdges` (polygon-utils) — όχι inline `[...outer, ...inner.reverse()]`.
  const outline = closedRingFromEdges(toPoint2D(outer), toPoint2D(inner));
  if (outline.length < 3) return null;
  return { id: e.id, axis: toPoint2D(axis), outline };
}

/**
 * Μάζεψε column footprints + γραμμικά μέλη ως face-snap στόχους. Pure.
 */
export function collectMemberSnapTargets(
  entities: readonly Entity[],
  opts: Readonly<CollectMemberSnapTargetsOptions>,
): MemberSnapTargets {
  const footprints: Point2D[][] = [];
  const memberTargets: LinearMemberSnapTarget[] = [];
  const wantBeam = opts.memberKinds.includes('beam');
  const wantWall = opts.memberKinds.includes('wall');

  for (const e of entities) {
    if (opts.excludeId && e.id === opts.excludeId) continue;

    if (e.type === 'column') {
      const verts = (e as { geometry?: { footprint?: { vertices?: Pts } } }).geometry?.footprint?.vertices;
      if (verts && verts.length >= 3) footprints.push(toPoint2D(verts));
      continue;
    }
    if (wantBeam && e.type === 'beam') {
      const t = beamTarget(e);
      if (t) memberTargets.push(t);
      continue;
    }
    if (wantWall && e.type === 'wall') {
      const t = wallTarget(e);
      if (t) memberTargets.push(t);
    }
  }
  return { footprints, memberTargets };
}
