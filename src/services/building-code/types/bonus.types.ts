/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Types for ΝΟΚ bonus calculations (ν.4067/2012 πολεοδομικά κίνητρα).
 * Phase 1: A1 (urban incentives), A3 (nZEB energy), A5 (minimum coverage 120 m²).
 */

/** Individual bonus identifiers — Phase 1 scope. */
export type BonusId = 'A1a' | 'A1b' | 'A1c' | 'A1d' | 'A3_5' | 'A3_10' | 'A5';

/** A1 sub-scenarios (πολεοδομικά κίνητρα α–δ). */
export type A1Scenario = 'A1a' | 'A1b' | 'A1c' | 'A1d';

/** A3 nZEB tiers. */
export type A3Tier = '5pct' | '10pct';

/** User-selected bonus toggles — Partial because not all may be active. */
export type BonusSelections = Partial<Record<BonusId, boolean>>;

/** A single computed bonus line item for display and aggregation. */
export interface BonusLineItem {
  readonly id: BonusId;
  /** Human-readable label (i18n key). */
  readonly label: string;
  /** Extra ΣΔ granted by this bonus (absolute: extraSd × area = extra m²). */
  readonly extraSd: number;
  /** Extra coverage m² granted (can be negative for A1 penalty). */
  readonly extraCoverageM2: number;
  /** Legal citation (e.g. "ν.4067/2012, Άρθρο 10, §2α"). */
  readonly citation: string;
}

/** Aggregated result of all active bonuses for a given site. */
export interface BonusResult {
  readonly items: readonly BonusLineItem[];
  /** Sum of all extraSd values. */
  readonly totalExtraSd: number;
  /** Sum of all extraCoverageM2 values. */
  readonly totalExtraCoverageM2: number;
  /** baseBuildableM2 + totalExtraSd × area. */
  readonly adjustedMaxBuildableM2: number;
  /** baseCoverageM2 + totalExtraCoverageM2. */
  readonly adjustedMaxCoverageM2: number;
  /** Validation warnings (e.g. combo conflicts). */
  readonly warnings: readonly string[];
}
