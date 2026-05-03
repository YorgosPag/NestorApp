/**
 * @related ADR-186 Building Code Module — Phase 2 CRUD Form
 *
 * Project-level ΝΟΚ data persisted on the Project document (`project.buildingCode`).
 * Phase 2 ultra-minimal scope: 6 fields + provenance + validation flags.
 *
 * Engines runtime (gates, setbacks, bonuses) is OUT of Phase 2 scope.
 * Phase 3 will convert this partial into a full PlotSite for engine consumption.
 *
 * Decision log: ADR-186 §8 Q1-Q7, §8b Implementation Plan.
 */
import type { PlotType } from '@/services/building-code/types/site.types';

/**
 * Provenance of a numeric field value:
 * - 'zone' : value came from ZONE_PARAMETERS auto-fill (matches selected zone)
 * - 'user' : value was manually edited by the user (override)
 */
export type FieldProvenance = 'zone' | 'user';

/**
 * Provenance map for the 3 zone-derivable fields.
 * sd / coveragePct / maxHeight can each independently come from zone or user.
 */
export interface BuildingCodeProvenance {
  readonly sd: FieldProvenance;
  readonly coveragePct: FieldProvenance;
  readonly maxHeight: FieldProvenance;
}

/**
 * Per-frontage data — ADR-186 Phase 2.5.
 * Each entry links a plot frontage to a project address (ADR-167 SSoT).
 * `frontages.length` must equal `frontagesCount` after sync.
 */
export interface PlotFrontage {
  /** 1-based index matching ProjectAddress.frontageIndex */
  readonly index: number;
  /** Optional custom label (e.g. "Κύρια πρόσοψη") */
  readonly label?: string;
  /** FK → project.addresses[].id where address.type === 'frontage' */
  readonly addressId?: string;
  /** Is this the primary frontage for building permit purposes? */
  readonly isPrimaryFrontage?: boolean;
}

/**
 * Phase 2 Building Code data — persisted at `project.buildingCode`.
 *
 * Shape locked by ADR-186 §8b (Phase 2 implementation plan).
 * `enabled` reserved for future "Σχεδιάζω χωρίς κανονισμό" toggle.
 */
export interface ProjectBuildingCodePhase2 {
  /** Plot geometry type. Drives default frontage count. */
  readonly plotType: PlotType;

  /** Number of frontages (1..4). Auto-synced with plotType, user-overridable. */
  readonly frontagesCount: number;

  /**
   * Per-frontage data — Phase 2.5 (ADR-186 §8b, ADR-167).
   * Undefined on legacy records — hook initialises lazily from frontagesCount.
   * length === frontagesCount after init.
   */
  readonly frontages?: readonly PlotFrontage[];

  /** Selected ΝΟΚ zone ID (e.g. 'Β2'), or null = no zone / free input. */
  readonly zoneId: string | null;

  /** ΣΔ (Συντελεστής Δόμησης). */
  readonly sd: number;

  /** Κάλυψη % (0..100). */
  readonly coveragePct: number;

  /** Μέγιστο ύψος (m). */
  readonly maxHeight: number;

  /** Per-field source tracking. */
  readonly provenance: BuildingCodeProvenance;

  /** Future toggle: false = "draw without code constraints". Default: true. */
  readonly enabled: boolean;

  /** ISO timestamp of last save — for staleness/audit display. */
  readonly lastUpdated: string;
}

/**
 * Validation severity levels.
 * - 'error'   : hard block (save disabled)
 * - 'warning' : soft warning (save allowed, audit logs override)
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * Field-scoped validation issue produced by validateBuildingCodePhase2().
 */
export interface ValidationIssue {
  readonly field: keyof Pick<
    ProjectBuildingCodePhase2,
    'sd' | 'coveragePct' | 'maxHeight' | 'frontagesCount'
  >;
  readonly severity: ValidationSeverity;
  /** i18n key under `buildingCode.validation.*` (no defaultValue literal). */
  readonly i18nKey: string;
  /** Threshold metadata for audit logging when severity = 'warning'. */
  readonly threshold?: string;
}

/**
 * Result of running validation against a ProjectBuildingCodePhase2 candidate.
 */
export interface BuildingCodeValidationResult {
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
}
