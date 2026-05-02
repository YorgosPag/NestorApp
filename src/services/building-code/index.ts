/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Public API barrel for the ΝΟΚ building-code module.
 *
 * Phase 1 scope (this module):
 *   - Pure types, constants, and engines (ΣΔ, κάλυψη, αποστάσεις, bonuses, gates)
 *   - Zero React, zero Firestore, zero AI — pure deterministic functions only
 *
 * Phase 2 (planned):
 *   - Firestore persistence (project.buildingCode object)
 *   - UI panels (Project Settings + DXF Viewer)
 *   - Gate 2 (Brief application) once BriefData is ported
 *   - Ιδεατό Στερεό 3D engine
 *   - Building Code Provider Interface (multi-country support)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type {
  PlotSite,
  PlotFrontage,
  PlotType,
  AreaRegime,
  TerrainSlope,
  ExpropriationInfo,
  EncumbranceInfo,
  ArtiotitaRule,
  ArtiotitaRules,
  AdjacentBuilding,
  SiteUpdatePayload,
} from '@/services/building-code/types/site.types';

export type {
  EdgeRole,
  EdgeSetback,
  SetbackResult,
} from '@/services/building-code/types/setback.types';

export type {
  ZoneParameters,
  ZoneArtiotita,
} from '@/services/building-code/types/zone.types';

export type {
  BonusId,
  A1Scenario,
  A3Tier,
  BonusSelections,
  BonusLineItem,
  BonusResult,
} from '@/services/building-code/types/bonus.types';

export type {
  GateStatus,
  GateCheck,
  GateResult,
} from '@/services/building-code/types/gate.types';

// ─── Engines ──────────────────────────────────────────────────────────────────

export {
  deriveSiteValues,
  calcSyntEfarm,
  calcMaxCoverageM2,
  calcMandatoryOpenM2,
  calcMaxBuildableM2,
  calcOriginalArea,
} from '@/services/building-code/engines/site-calculator';

export {
  computeSetbackResult,
  classifyEdges,
  computeEdgeSetbacks,
  insetPolygon,
  computeCentroid,
  computeMinEdgeLength,
} from '@/services/building-code/engines/setback-calculator';

export {
  applyBonuses,
  calcA1Bonus,
  calcA3Bonus,
  calcA5Bonus,
} from '@/services/building-code/engines/bonus-calculator';

export {
  lookupZone,
  normalizeZoneId,
} from '@/services/building-code/engines/zone-resolver';

export {
  runAllGates,
  runGate0,
  runGate3,
  runGate5,
  runGate22,
} from '@/services/building-code/engines/gate-checker';

export { runGateBonuses } from '@/services/building-code/engines/gate-bonuses';
export { runGateSetback } from '@/services/building-code/engines/gate-setback';

// ─── Constants ────────────────────────────────────────────────────────────────

export {
  ZONE_PARAMETERS,
  RESIDENTIAL_USES,
  MIXED_USES,
  CENTRAL_USES,
  RESIDENTIAL_EXCEPTION,
  OUT_OF_PLAN_USES,
  OUT_EXCEPTION,
} from '@/services/building-code/constants/zones.constants';

export {
  DEFAULT_DELTA_MIN_M,
  MIN_BUILDABLE_SIDE_M,
  MIN_ADJACENT_CLEARANCE_M,
} from '@/services/building-code/constants/setback.constants';

export {
  BONUS_A1_COVERAGE_REDUCTION,
  BONUS_A5_MIN_COVERAGE_M2,
  BONUS_A5_MAX_COVERAGE_PCT,
  NZEB_SD_5PCT,
  NZEB_SD_10PCT,
} from '@/services/building-code/constants/bonuses.constants';

// ─── Utilities ────────────────────────────────────────────────────────────────

export {
  shoelaceArea,
  polyEdgeLabel,
  inwardNormal,
  POLY_CORNER_LETTERS,
} from '@/services/building-code/utils/geometry';
