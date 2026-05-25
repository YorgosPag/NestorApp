/**
 * Slab-opening validator (ADR-363 Phase 3.7).
 *
 * Pure function — zero React / DOM / Firestore deps. Mirrors
 * opening/slab-validator SSoT pattern: hard errors block creation, code
 * violations non-blocking (red badge στο property panel).
 *
 * Phase 3.7 scope:
 *   - **Hard errors** (block creation):
 *       · slabId missing / empty
 *       · vertices.length < MIN_SLAB_OPENING_VERTICES (3)
 *       · polygon self-intersecting
 *       · area below MIN_SLAB_OPENING_AREA_MM2
 *       · outline outside host slab footprint (point-in-polygon)
 *   - **Code violations** (non-blocking):
 *       · min bbox dimension < SLAB_OPENING_MIN_DIMENSION_MM[kind]
 *
 * Host-slab arg may be `null` (slab not yet hydrated). Σε αυτή τη περίπτωση
 * τρέχουν μόνο intrinsic checks — host-relative re-runs μετά το rehydrate.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../types/bim-base';
import {
  MIN_SLAB_OPENING_AREA_MM2,
  MIN_SLAB_OPENING_VERTICES,
  SLAB_OPENING_MIN_DIMENSION_MM,
  type SlabOpeningParams,
} from '../types/slab-opening-types';
import type { SlabEntity } from '../types/slab-types';
import {
  isPolygonSelfIntersecting,
  pointInPolygon,
  polygonArea,
} from '../geometry/shared/polygon-utils';
import { getSlabOpeningMinDimensionMm } from '../geometry/slab-opening-geometry';
import { mmToSceneUnits } from '../../utils/scene-units';

/** Result of a slab-opening validation pass — hard errors non-empty when invalid. */
export interface SlabOpeningValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge. i18n keys. */
  readonly codeViolations: readonly string[];
  /** Direct `BimValidation` payload. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `SlabOpeningParams` against optional host slab.
 *
 * Pure: zero side-effects, deterministic.
 */
export function validateSlabOpeningParams(
  params: SlabOpeningParams,
  hostSlab: SlabEntity | null,
): SlabOpeningValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  validateHostRef(params, hardErrors);
  validateOutline(params, hardErrors);
  validateAgainstHost(params, hostSlab, hardErrors);
  validateMinDimension(params, codeViolations);

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}

// ─── Internal checks ────────────────────────────────────────────────────────

function validateHostRef(params: SlabOpeningParams, hardErrors: string[]): void {
  if (!params.slabId || params.slabId.trim() === '') {
    hardErrors.push('slabOpening.validation.hardErrors.missingHostSlab');
  }
}

function validateOutline(params: SlabOpeningParams, hardErrors: string[]): void {
  const verts = params.outline.vertices;
  if (verts.length < MIN_SLAB_OPENING_VERTICES) {
    hardErrors.push('slabOpening.validation.hardErrors.tooFewVertices');
    return;
  }
  if (isPolygonSelfIntersecting(verts)) {
    hardErrors.push('slabOpening.validation.hardErrors.selfIntersecting');
  }
  // `polygonArea` returns area σε vertex units². Όταν το scene δουλεύει σε
  // m/cm/in/ft, ανάγουμε στη μονάδα του threshold (mm²) πριν τη σύγκριση.
  const mmFactor = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const canvasToMm2 = 1 / (mmFactor * mmFactor);
  const areaMm2 = polygonArea(verts) * canvasToMm2;
  if (areaMm2 < MIN_SLAB_OPENING_AREA_MM2) {
    hardErrors.push('slabOpening.validation.hardErrors.zeroArea');
  }
}

function validateAgainstHost(
  params: SlabOpeningParams,
  hostSlab: SlabEntity | null,
  hardErrors: string[],
): void {
  if (!hostSlab) return;
  const slabVerts = hostSlab.geometry?.polygon.vertices;
  if (!slabVerts || slabVerts.length < 3) return;
  const openingVerts = params.outline.vertices;
  if (openingVerts.length < MIN_SLAB_OPENING_VERTICES) return;
  // Cutout MUST sit entirely inside host slab. Test each opening vertex
  // against slab polygon — αν έστω και μία έξω, hard error.
  for (const v of openingVerts) {
    if (!pointInPolygon(v, slabVerts)) {
      hardErrors.push('slabOpening.validation.hardErrors.outlineOutsideSlab');
      return;
    }
  }
}

function validateMinDimension(
  params: SlabOpeningParams,
  codeViolations: string[],
): void {
  if (params.outline.vertices.length < MIN_SLAB_OPENING_VERTICES) return;
  const minDim = getSlabOpeningMinDimensionMm(params);
  const threshold = SLAB_OPENING_MIN_DIMENSION_MM[params.kind];
  if (minDim < threshold) {
    codeViolations.push('slabOpening.validation.codeViolations.tooSmallForKind');
  }
}
