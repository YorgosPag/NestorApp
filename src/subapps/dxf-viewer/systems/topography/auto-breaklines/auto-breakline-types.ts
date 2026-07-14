/**
 * ADR-650 M8β/Γ — auto-breakline candidate shapes.
 *
 * A CANDIDATE is not a breakline: it is a PROPOSAL, and it stays one until the engineer ticks
 * it and presses «Προσθήκη» (§9 — human-certifier; Civil 3D and CloudCompare both propose and
 * wait). Nothing in this module reaches the survey definition: only the panel's explicit
 * confirm calls `addBreakline`, which is where the enterprise id is minted (N.6). Hence the
 * candidate's own `id` is a transient, deterministic review key — never persisted.
 *
 * Types file (no logic) — exempt from the 500-line rule.
 */

import type { TopoPoint, TopoSurfaceId } from '../topo-types';

/** One proposed feature line: an ordered WORLD polyline chained from steep TIN folds. */
export interface AutoBreaklineCandidate {
  /** Transient review key (stable within one report). The stored id is minted on accept. */
  readonly id: string;
  /** Ordered vertices in WORLD canonical mm. When `closed`, the first is NOT repeated. */
  readonly vertices: readonly TopoPoint[];
  /** True when the chain returns to its start (a ring — e.g. the rim of a pond). */
  readonly closed: boolean;
  /** Planimetric length of the chain (canonical mm) — the «is this worth it?» number. */
  readonly lengthMm: number;
  /** Mean dihedral fold along the chain (degrees) — how hard the surface breaks here. */
  readonly avgFoldDeg: number;
  /** How many TIN edges the chain consumed (closing edge included when `closed`). */
  readonly edgeCount: number;
}

/** The outcome of one extraction pass over a surface. Read-only — the survey is untouched. */
export interface AutoBreaklineReport {
  readonly surfaceId: TopoSurfaceId;
  /** Candidates, longest first (a road edge outranks a short spur). */
  readonly candidates: readonly AutoBreaklineCandidate[];
  /** Candidates beyond `MAX_CANDIDATES` — surfaced to the engineer, never silently dropped. */
  readonly droppedByCap: number;
  /** True when there is no triangulated surface to extract from. */
  readonly notEnoughData: boolean;
}
