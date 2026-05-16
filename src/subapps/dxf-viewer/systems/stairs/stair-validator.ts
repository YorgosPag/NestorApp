/**
 * ADR-358 Phase 6 — Stair validator SSoT facade.
 *
 * Pure function: zero React / DOM / Firestore / canvas deps. Wraps the
 * `gateStairChecker` engine (4 code profiles + hard errors) and adds a cheap
 * 2D headroom proxy check (Q29 hybrid: cheap real-time part; Phase 9 will
 * replace with 3D raycast over per-step nosing positions).
 *
 * Headroom proxy (Phase 6 cheap 2D):
 *   - Filter context entities by layer regex /ceiling|slab|roof/i.
 *   - Read `metadata.elevation` (mm) when present; entities without elevation
 *     are skipped (no false positives).
 *   - Clearance = ceiling.elevation − (params.basePoint.z + params.totalRise).
 *   - Violation if clearance < `MIN_HEADROOM[codeProfile]`.
 *
 * Validator behavior (§5.9):
 *   - hardErrors → caller blocks creation.
 *   - codeViolations / adaViolations / headroomViolations → non-blocking,
 *     red badge in property panel, entity created with
 *     `validation.hasCodeViolations = true`.
 *
 * Egress (G20) intentionally undefined here — Phase 6.5 placeholder per spec.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.9 §3.5 §9.2 Q25 Q26 Q29
 */

import { Timestamp } from 'firebase/firestore';
import { gateStairChecker } from '@/services/building-code/engines/gate-stair-checker';
import type { Entity } from '../../types/entities';
import type {
  StairCodeProfile,
  StairParams,
  StairValidationState,
} from '../../types/stair';

// ─── Headroom thresholds (cheap 2D proxy, Phase 6) ───────────────────────────

const MIN_HEADROOM_MM: Readonly<Record<StairCodeProfile, number>> = {
  nok: 2030,
  ibc: 2030,
  eurocode: 2030,
  ada: 2032,
  nbc: 2030,
  nfpa: 2030,
  as1657: 2030,
  din: 2030,
  none: 0,
};

const CEILING_LAYER_RE = /ceiling|slab|roof/i;

// ─── Headroom check (cheap 2D, Phase 6) ──────────────────────────────────────

function extractEntityElevation(entity: Readonly<Entity>): number | null {
  const meta = entity.metadata;
  if (!meta) return null;
  const raw = (meta as Readonly<Record<string, unknown>>).elevation;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function checkHeadroom(
  params: Readonly<StairParams>,
  contextEntities: readonly Entity[],
): readonly string[] {
  const profile = params.codeProfile;
  if (profile === 'none' || contextEntities.length === 0) return [];
  const minClearance = MIN_HEADROOM_MM[profile];
  const stairTopZ = params.basePoint.z + params.totalRise;
  for (const entity of contextEntities) {
    if (!entity.layer || !CEILING_LAYER_RE.test(entity.layer)) continue;
    const elevation = extractEntityElevation(entity);
    if (elevation === null) continue;
    const clearance = elevation - stairTopZ;
    if (clearance < minClearance) return ['tools.stair.validator.headroomBelowMin'];
  }
  return [];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate a `StairParams` against its declared `codeProfile` + universal
 * hard-error baseline + cheap 2D headroom proxy. Returns a fully-populated
 * `StairValidationState` ready to be embedded in `StairEntity.validation`.
 *
 * @param params Parametric stair input (codeProfile + nokSubType read internally).
 * @param contextEntities Optional scene entities for the headroom proxy. Pass
 *   an empty array (or omit) to skip the headroom step.
 */
export function validateStairParams(
  params: Readonly<StairParams>,
  contextEntities: readonly Entity[] = [],
): StairValidationState {
  const gate = gateStairChecker({
    params,
    codeProfile: params.codeProfile,
    nokSubType: params.nokSubType,
  });
  const headroomViolations = checkHeadroom(params, contextEntities);
  const violationKeys: readonly string[] = [
    ...gate.hardErrors,
    ...gate.codeViolations,
    ...gate.adaViolations,
    ...headroomViolations,
  ];
  return {
    hasCodeViolations: violationKeys.length > 0,
    violationKeys,
    headroomViolations: headroomViolations.length > 0 ? headroomViolations : undefined,
    egressViolations: undefined,
    adaViolations: gate.adaViolations.length > 0 ? gate.adaViolations : undefined,
    lastValidatedAt: Timestamp.now(),
  };
}

/** Re-export the engine result shape for callers that want raw access. */
export type { GateStairCheckerResult } from '@/services/building-code/engines/gate-stair-checker';
