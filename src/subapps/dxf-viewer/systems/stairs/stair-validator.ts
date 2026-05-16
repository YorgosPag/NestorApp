/**
 * ADR-358 Phase 6 + 6.5 — Stair validator SSoT facade.
 *
 * Pure function: zero React / DOM / Firestore / canvas deps. Wraps the
 * `gateStairChecker` engine (4 code profiles + hard errors + egress) and adds
 * a cheap 2D headroom proxy check (Q29 hybrid: cheap real-time part; Phase 9
 * will replace with 3D raycast over per-step nosing positions).
 *
 * Headroom proxy (Phase 6 cheap 2D):
 *   - Filter context entities by layer regex /ceiling|slab|roof/i.
 *   - Read `metadata.elevation` (mm) when present; entities without elevation
 *     are skipped (no false positives).
 *   - Clearance = ceiling.elevation − (params.basePoint.z + params.totalRise).
 *   - Violation if clearance < `MIN_HEADROOM[codeProfile]`.
 *
 * Egress G20 (Phase 6.5):
 *   - Universal IBC §1011.5 capacity check: `width < occupancyLoad × 7.62mm`.
 *   - Resolution order: `projectOccupancyLoad` (Q27 project setting) wins over
 *     `params.occupancyLoad` (per-stair override). If both absent → skipped.
 *   - Skipped when `codeProfile === 'none'`.
 *
 * Validator behavior (§5.9):
 *   - hardErrors → caller blocks creation.
 *   - codeViolations / adaViolations / headroomViolations / egressViolations
 *     → non-blocking, red badge in property panel, entity created with
 *     `validation.hasCodeViolations = true`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.9 §3.5 §3.7 §9.2 Q25 Q26 Q27 Q29
 */

import { Timestamp } from 'firebase/firestore';
import { gateStairChecker } from '@/services/building-code/engines/gate-stair-checker';
import type { Entity } from '../../types/entities';
import type {
  StairCodeProfile,
  StairParams,
  StairValidationState,
} from '../../types/stair';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT
import { resolveEntityLayerName } from '../../stores/LayerStore';

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
    // ADR-358 Phase 9D-3b: id-first via LayerStore, name fallback
    const layerName = resolveEntityLayerName(entity);
    if (!layerName || !CEILING_LAYER_RE.test(layerName)) continue;
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
 * hard-error baseline + cheap 2D headroom proxy + egress capacity check.
 * Returns a fully-populated `StairValidationState` ready to be embedded in
 * `StairEntity.validation`.
 *
 * @param params Parametric stair input (codeProfile + nokSubType read internally).
 * @param contextEntities Optional scene entities for the headroom proxy. Pass
 *   an empty array (or omit) to skip the headroom step.
 * @param projectOccupancyLoad Optional Q27 project-default occupancy load.
 *   When present overrides `params.occupancyLoad`. When absent the per-stair
 *   `params.occupancyLoad` is used. When both absent the egress check is
 *   skipped (no false positives).
 */
export function validateStairParams(
  params: Readonly<StairParams>,
  contextEntities: readonly Entity[] = [],
  projectOccupancyLoad?: number,
): StairValidationState {
  const occupancyLoad = projectOccupancyLoad ?? params.occupancyLoad;
  const gate = gateStairChecker({
    params,
    codeProfile: params.codeProfile,
    nokSubType: params.nokSubType,
    occupancyLoad,
  });
  const headroomViolations = checkHeadroom(params, contextEntities);
  const violationKeys: readonly string[] = [
    ...gate.hardErrors,
    ...gate.codeViolations,
    ...gate.adaViolations,
    ...gate.egressViolations,
    ...headroomViolations,
  ];
  return {
    hasCodeViolations: violationKeys.length > 0,
    violationKeys,
    headroomViolations: headroomViolations.length > 0 ? headroomViolations : undefined,
    egressViolations: gate.egressViolations.length > 0 ? gate.egressViolations : undefined,
    adaViolations: gate.adaViolations.length > 0 ? gate.adaViolations : undefined,
    lastValidatedAt: Timestamp.now(),
  };
}

/** Re-export the engine result shape for callers that want raw access. */
export type { GateStairCheckerResult } from '@/services/building-code/engines/gate-stair-checker';
