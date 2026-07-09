/**
 * Opening validator (ADR-363 Phase 2).
 *
 * Pure function: zero React / DOM / Firestore deps. Validates dimensional
 * sanity + host-relation consistency. Mirrors wall-validator SSoT pattern:
 * hard errors block creation, code violations are non-blocking (red badge).
 *
 * Phase 2 scope:
 *   - **Hard errors** (block creation):
 *       · wallId missing / empty — ONLY for wall-hosted openings (ADR-615:
 *         self-hosted openings, i.e. `isSelfHostedOpening(params)`, skip this
 *         check and instead require a well-formed `selfHost` — see
 *         `validateSelfHost`: finite anchor, hostThicknessMm > 0, finite
 *         rotationRad).
 *       · width < MIN_OPENING_WIDTH_MM
 *       · height < MIN_OPENING_HEIGHT_MM
 *       · offsetFromStart < 0
 *       · offsetFromStart + width > hostWall.length (overflows host)
 *       · sillHeight + height > hostWall.height (overflows host vertically)
 *       · sillHeight < 0
 *   - **Code violations** (non-blocking):
 *       · width > 2 × hostWall.thickness (unusually wide για το thickness)
 *       · door με sillHeight > 0 (typically zero — possible auth user error)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see docs/centralized-systems/reference/adrs/ADR-615-free-standing-self-hosted-opening.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../types/bim-base';
import {
  MIN_OPENING_WIDTH_MM,
  MIN_OPENING_HEIGHT_MM,
  isSelfHostedOpening,
  type OpeningParams,
  type OpeningSelfHost,
} from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';

const MM_TO_M = 1 / 1000;

/** Result of an opening validation pass — hard errors non-empty when invalid. */
export interface OpeningValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload για direct assignment στο `OpeningEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `OpeningParams` against the host wall.
 *
 * `hostWall` may be `null` when the wall is not (yet) loaded into the scene —
 * in that case only intrinsic checks run (width / height / sill / wallId).
 * The host-relative checks (offset bounds, vertical fit) are re-run by the
 * persistence layer once the wall hydrates.
 */
export function validateOpeningParams(
  params: OpeningParams,
  hostWall: WallEntity | null,
): OpeningValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  validateHostRef(params, hardErrors);
  validateIntrinsic(params, hardErrors);
  validateAgainstHost(params, hostWall, hardErrors, codeViolations);

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}

// ─── Internal checks ────────────────────────────────────────────────────────

function validateHostRef(params: OpeningParams, hardErrors: string[]): void {
  // ADR-615 — self-hosted openings carry no `wallId`; they are valid as long
  // as `selfHost` itself is well-formed. `isSelfHostedOpening` already
  // guarantees `selfHost` is present (discriminator: !wallId && !!selfHost);
  // the `&& params.selfHost` re-check below is a pure type-narrow, no `as`.
  if (isSelfHostedOpening(params) && params.selfHost) {
    validateSelfHost(params.selfHost, hardErrors);
    return;
  }
  if (!params.wallId || params.wallId.trim() === '') {
    hardErrors.push('opening.validation.hardErrors.missingHostWall');
  }
}

/** ADR-615 — intrinsic sanity of the synthesized self-host params. */
function validateSelfHost(selfHost: OpeningSelfHost, hardErrors: string[]): void {
  const { anchor, hostThicknessMm, rotationRad } = selfHost;
  const anchorValid =
    !!anchor &&
    Number.isFinite(anchor.x) &&
    Number.isFinite(anchor.y) &&
    Number.isFinite(anchor.z);
  if (!anchorValid) {
    hardErrors.push('opening.validation.hardErrors.selfHostAnchorInvalid');
  }
  if (!(hostThicknessMm > 0)) {
    hardErrors.push('opening.validation.hardErrors.selfHostThicknessInvalid');
  }
  if (!Number.isFinite(rotationRad)) {
    hardErrors.push('opening.validation.hardErrors.selfHostRotationInvalid');
  }
}

function validateIntrinsic(params: OpeningParams, hardErrors: string[]): void {
  if (params.width < MIN_OPENING_WIDTH_MM) {
    hardErrors.push('opening.validation.hardErrors.widthTooSmall');
  }
  if (params.height < MIN_OPENING_HEIGHT_MM) {
    hardErrors.push('opening.validation.hardErrors.heightTooSmall');
  }
  if (params.offsetFromStart < 0) {
    hardErrors.push('opening.validation.hardErrors.offsetNegative');
  }
  if (params.sillHeight < 0) {
    hardErrors.push('opening.validation.hardErrors.sillNegative');
  }
}

function validateAgainstHost(
  params: OpeningParams,
  hostWall: WallEntity | null,
  hardErrors: string[],
  codeViolations: string[],
): void {
  if (!hostWall) return;
  // wall.geometry.length is in metres; convert back to mm.
  const wallLengthMm = hostWall.geometry.length / MM_TO_M;
  const wallHeightMm = hostWall.params.height;
  const wallThicknessMm = hostWall.params.thickness;

  if (params.offsetFromStart + params.width > wallLengthMm + 1) {
    hardErrors.push('opening.validation.hardErrors.overflowsHostLength');
  }
  if (params.sillHeight + params.height > wallHeightMm + 1) {
    hardErrors.push('opening.validation.hardErrors.overflowsHostHeight');
  }
  // Wide-opening warning (Boy Scout): walls bear poorly when opening width
  // exceeds 2× wall thickness without a lintel — flag for the contractor.
  if (wallThicknessMm > 0 && params.width > 2 * wallThicknessMm) {
    codeViolations.push('opening.validation.codeViolations.widthExceedsThicknessRatio');
  }
  if (params.kind === 'door' && params.sillHeight > 0) {
    codeViolations.push('opening.validation.codeViolations.doorWithSill');
  }
}
