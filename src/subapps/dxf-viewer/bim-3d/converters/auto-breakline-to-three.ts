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
  appendProjectedPolylineSegments,
  appendTopoPolylineSegments,
  projectTopoPolylineVertices,
  toTopoLineGeometry,
} from './topo-polyline-to-three';
import { selectPolylineCornerIndices } from './polyline-corner-vertices';

/** The per-build display inputs, resolved by the impure caller (mirror of `ContourLineOptions`). */
export interface AutoBreaklineConvertOptions {
  /** ADR-650 M10b — active WORLD (ΕΓΣΑ) → building-DISPLAY projector. Omitted/identity → world. */
  readonly projector?: WorldToDisplayProjector | null;
  /** ADR-650 M10c — project vertical datum (WORLD mm) subtracted from every vertex elevation. */
  readonly datumMm?: number;
}

/**
 * One bucket per review state. `null` = that bucket is empty.
 *
 * The two approval buckets are `BufferGeometry` (thin `THREE.LineSegments`, one draw call each);
 * the focused ones are raw POSITION BUFFERS because they feed the fat-line pipeline, whose
 * `LineSegmentsGeometry.setPositions` takes the flat array directly. The asymmetry is the
 * pipelines', not this module's — and it is deliberate that it shows in the type instead of being
 * hidden behind a geometry that the caller would immediately have to unpack again.
 */
export interface AutoBreaklineCandidateGeometries {
  readonly approved: THREE.BufferGeometry | null;
  readonly rejected: THREE.BufferGeometry | null;
  /**
   * The focused candidate as flat segment-pair positions, for `LineSegments2`.
   *
   * ADR-650 M8β/Γ v2 — this replaced a thin `LineSegments`. The v1 note («thickness is not
   * expressible, the fat-line path would need per-resize `resolution` plumbing the scene layer does
   * not have») was **wrong on the second half**: `bimEdgeResolutionStore` has published that
   * resolution scene-wide since ADR-375 Phase C.7, written by the scene manager on every resize.
   * The emphasis therefore reads as a LINE with width — the same sentence the 2D preview says —
   * instead of leaning entirely on vertex dots.
   */
  readonly focused: Float32Array | null;
  /**
   * The focused candidate's SIGNIFICANT vertices — ends + real corners — one XYZ each, for
   * `THREE.Points`.
   *
   * Deduplicated and thinned, unlike v1, where this was literally the same buffer as {@link
   * focused} (each vertex twice, once per adjoining segment). That was harmless while the dots were
   * carrying the whole emphasis on a 9-vertex synthetic ridge; on a surveyed boundary with 50+
   * vertices it is a stipple band, and it double-blends every dot the moment the material becomes
   * translucent. See `polyline-corner-vertices` for the selection rule.
   */
  readonly focusedVertices: Float32Array | null;
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
  let focusedVertices: Float32Array | null = null;

  for (const candidate of candidates) {
    const { vertices } = candidate;
    // per-vertex: a feature line climbs, a contour does not
    const elevationMmAt = (i: number): number => vertices[i]!.z - datumMm;

    if (candidate.id !== focusedId) {
      const buf = selected.has(candidate.id) ? approved : rejected;
      appendTopoPolylineSegments(buf, vertices, elevationMmAt, candidate.closed, project);
      continue;
    }

    // The focused candidate is projected ONCE and read twice — the line's segments and the corner
    // markers address the SAME vertices, so a second projection would be a second chance to drift.
    const points = projectTopoPolylineVertices(vertices, elevationMmAt, project);
    appendProjectedPolylineSegments(focused, points, candidate.closed);
    focusedVertices = collectCornerPositions(points, candidate.closed);
  }

  return {
    approved: toTopoLineGeometry(approved),
    rejected: toTopoLineGeometry(rejected),
    focused: focused.length === 0 ? null : new Float32Array(focused),
    focusedVertices,
  };
}

/** Pack the selected corner vertices of a projected chain into their own positions buffer. */
function collectCornerPositions(points: Float32Array, closed: boolean): Float32Array | null {
  const indices = selectPolylineCornerIndices(points, closed);
  if (indices.length === 0) return null;
  const out = new Float32Array(indices.length * 3);
  indices.forEach((vertex, slot) => {
    out[slot * 3] = points[vertex * 3]!;
    out[slot * 3 + 1] = points[vertex * 3 + 1]!;
    out[slot * 3 + 2] = points[vertex * 3 + 2]!;
  });
  return out;
}
