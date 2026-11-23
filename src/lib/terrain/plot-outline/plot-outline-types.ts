/**
 * @fileoverview **Plot outline — the shapes the pure core speaks in** (ADR-920 §14.11 Ζ1). Types only.
 *
 * 🔑 Frame: every ring here is in **WORLD canonical mm** (ΕΓΣΑ'87 × 1000, ADR-462), implicitly closed (no repeated
 *    first point) — the frame of the terrain source. The snapshot's centred frame (Δ3) is Ζ2's business.
 * 🔑 Nothing is chosen silently (Π4): a candidate carries NAMED evidence, a refusal carries a NAMED reason.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

/** The four kinds of evidence a candidate can carry (Π4). Simplicity is not evidence — it is a precondition. */
export type PlotOutlineEvidenceKind = 'layer-name' | 'declared-area' | 'relief-overlap' | 'corner-labels';

export type PlotOutlineVerdict = 'for' | 'against' | 'unknown';

/** Evidence, each with the fact it rests on — the screen shows the fact, not a score. */
export type PlotOutlineEvidence =
  | { readonly kind: 'layer-name'; readonly verdict: PlotOutlineVerdict; readonly layer: string; readonly stem: string | null }
  | {
      readonly kind: 'declared-area';
      readonly verdict: PlotOutlineVerdict;
      /** The area it was compared with, m², and where that number came from. */
      readonly declaredM2: number | null;
      readonly declaredBy: 'listing' | 'drawing' | null;
      /** |Δ| / declared; `null` when nothing was declared. */
      readonly relativeDifference: number | null;
    }
  | { readonly kind: 'relief-overlap'; readonly verdict: PlotOutlineVerdict; readonly coveredFraction: number | null }
  | {
      readonly kind: 'corner-labels';
      readonly verdict: PlotOutlineVerdict;
      readonly labelledCorners: number;
      readonly corners: number;
    };

/** Where a candidate came from — enough for the owner to find it again in the drawing. */
export type PlotOutlineOrigin =
  | {
      readonly source: 'dxf';
      readonly handle: string | null;
      readonly layer: string;
      /** `flag` = the CLOSED bit · `coincident-ends` = open polyline whose last vertex returns onto the first. */
      readonly closure: 'flag' | 'coincident-ends';
    }
  | { readonly source: 'pdf-table'; readonly page: number };

/** A ring that can be proposed as the plot outline. */
export interface PlotOutlineCandidate {
  /** Stable within one reading of one file (`dxf:<handle>` or `dxf#<n>`, `pdf:<page>:<n>`). */
  readonly id: string;
  readonly origin: PlotOutlineOrigin;
  /** The outline, arcs tessellated, WORLD mm. */
  readonly ringWorldMm: readonly PlanarPoint[];
  /** The drawn corners (before arc tessellation), WORLD mm, with the label found at each (`null` = none). */
  readonly corners: readonly PlotOutlineCorner[];
  /** Plan area, m². */
  readonly areaM2: number;
}

export interface PlotOutlineCorner {
  readonly at: PlanarPoint;
  readonly label: string | null;
}

/** Why a closed polyline cannot be the plot outline at all. */
export type PlotOutlineRejection = 'self-intersecting' | 'zero-area' | 'too-many-corners';

export interface RejectedPlotOutline {
  readonly id: string;
  readonly origin: PlotOutlineOrigin;
  readonly reason: PlotOutlineRejection;
}

/** A candidate with its evidence and its standing. */
export interface RankedPlotOutline {
  readonly candidate: PlotOutlineCandidate;
  readonly evidence: readonly PlotOutlineEvidence[];
  /** (#for) − (#against). Shown nowhere as a number — it only orders the list. */
  readonly standing: number;
}

/**
 * The ranking (Π4). `proposedId` is set ONLY when one candidate stands strictly above all others AND has at least one
 * piece of evidence FOR it — otherwise `null`, and the owner picks (a tie is never broken by a hidden rule).
 */
export interface PlotOutlineRanking {
  readonly ranked: readonly RankedPlotOutline[];
  readonly proposedId: string | null;
  /** Why nothing was proposed, when nothing was. */
  readonly noProposalReason: 'no-candidates' | 'tie' | 'no-evidence' | null;
}
