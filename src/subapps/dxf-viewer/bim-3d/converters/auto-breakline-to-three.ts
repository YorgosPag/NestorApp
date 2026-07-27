/**
 * ADR-650 M8β/Γ — auto-breakline CANDIDATES → `THREE.BufferGeometry` line segments, on the terrain.
 *
 * The 3D twin of `TopoAutoBreaklinePreviewOverlay` (the 2D SVG preview), and it exists for the same
 * §9 reason: the engineer certifies what he can SEE. Until now a proposal existed only in plan, so
 * the moment he orbited the site to judge whether that fold really is a ridge — which is the one
 * view in which a ridge is legible at all — the proposals vanished and the panel's list became
 * numbers again.
 *
 * Three buckets, because they answer two independent questions at once and a review surface must
 * answer both (same contract as the 2D preview and as the QA ⊙, where severity stays visible
 * underneath the selection):
 *   - **approved / rejected** — will this be written on «Προσθήκη»?
 *   - **focused** — is this the one I just clicked in the list?
 *
 * A focused candidate is drawn in its OWN bucket rather than restyled in place: it must render
 * last, in the selection colour, unoccluded by the hill (see the layer), and a bucket is the only
 * way `LineSegments` can express «this one on top».
 *
 * Pure: no store, no scene. The impure layer resolves projector + datum from the SAME SSoTs the
 * terrain mesh reads and passes them in, so a candidate cannot float off the ground it was
 * extracted from. Elevation is **per vertex** — a feature line climbs, unlike a contour.
 *
 * @module bim-3d/converters/auto-breakline-to-three
 */

import type * as THREE from 'three';
import type { AutoBreaklineCandidate } from '../../systems/topography/auto-breaklines/auto-breakline-types';
import type { WorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';
import {
  activeProjector,
  appendTopoPolylineSegments,
  toTopoLineGeometry,
} from './topo-polyline-to-three';

/** The per-build display inputs, resolved by the impure caller (mirror of `ContourLineOptions`). */
export interface AutoBreaklineConvertOptions {
  /** ADR-650 M10b — active WORLD (ΕΓΣΑ) → building-DISPLAY projector. Omitted/identity → world. */
  readonly projector?: WorldToDisplayProjector | null;
  /** ADR-650 M10c — project vertical datum (WORLD mm) subtracted from every vertex elevation. */
  readonly datumMm?: number;
}

/** One geometry per review state. `null` = that bucket is empty. */
export interface AutoBreaklineCandidateGeometries {
  readonly approved: THREE.BufferGeometry | null;
  readonly rejected: THREE.BufferGeometry | null;
  readonly focused: THREE.BufferGeometry | null;
  /**
   * The focused candidate's vertices, as a positions buffer to draw with `THREE.Points`.
   *
   * This is how the focused line gets its «μέγεθος» in 3D: `LineBasicMaterial.linewidth` is
   * IGNORED by WebGL (the OpenGL core profile / ANGLE caps it at 1 px), so a thicker line is simply
   * not expressible without the fat-line pipeline and its per-resize `resolution` plumbing. Screen-
   * sized vertex dots give the emphasis honestly and cost one extra draw call.
   *
   * It is the SAME buffer as {@link focused} — every vertex appears twice (once per adjoining
   * segment) and the duplicates draw exactly on top of each other, which is invisible. Re-projecting
   * the vertices into a second, deduplicated buffer would be a second copy of the transform chain
   * for zero visual difference, which is precisely what this module set out not to have.
   */
  readonly focusedVertices: THREE.BufferGeometry | null;
}

/**
 * Convert candidates under review into approved / rejected / focused line geometries.
 *
 * `selected` holds the APPROVED ids (the checkboxes); `focusedId` is the single row last clicked.
 * A focused candidate lands ONLY in the focused bucket — it is already unmistakable there, and
 * leaving it in its approval bucket too would draw it twice and z-fight with itself.
 */
export function autoBreaklineCandidatesToGeometries(
  candidates: readonly AutoBreaklineCandidate[],
  selected: ReadonlySet<string>,
  focusedId: string | null,
  options?: AutoBreaklineConvertOptions,
): AutoBreaklineCandidateGeometries {
  const datumMm = options?.datumMm ?? 0;
  const project = activeProjector(options?.projector);

  const approved: number[] = [];
  const rejected: number[] = [];
  const focused: number[] = [];

  for (const candidate of candidates) {
    const buf = candidate.id === focusedId ? focused : (selected.has(candidate.id) ? approved : rejected);
    const { vertices } = candidate;
    appendTopoPolylineSegments(
      buf,
      vertices,
      (i) => vertices[i]!.z - datumMm, // per-vertex: a feature line climbs, a contour does not
      candidate.closed,
      project,
    );
  }

  return {
    approved: toTopoLineGeometry(approved),
    rejected: toTopoLineGeometry(rejected),
    focused: toTopoLineGeometry(focused),
    focusedVertices: toTopoLineGeometry(focused),
  };
}
