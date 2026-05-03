/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Site/plot data model — ground truth for all ΝΟΚ gate computations.
 * Separate from Building data: site = context, building = AI output.
 */
import type { BonusSelections, BonusResult } from '@/services/building-code/types/bonus.types';
import type { SetbackResult } from '@/services/building-code/types/setback.types';

/** Planning zone regime per ν.4067/2012 */
export type AreaRegime = 'in_plan' | 'in_settlement' | 'out_of_plan';

/** Terrain slope category. */
export type TerrainSlope = 'flat' | 'mild' | 'steep'; // <10% / 10-20% / >20%

/**
 * Plot type per ν.4067/2012.
 * Affects Δ/δ rules, αρτιότητα, and ιδεατό στερεό per frontage.
 *
 * mesaio      = 1 frontage  (Μεσαίο — δρόμος μόνο μπροστά)
 * goniako     = 2 frontages at intersection (Γωνιακό)
 * diamperes   = 2 frontages on opposite roads (Διαμπερές)
 * disgoniaio  = 3 frontages (Δισγωνιαίο — Π-shape)
 * four_sided  = 4 frontages (Τεσσάρων πλευρών — νησιωτικό block)
 * custom      = irregular geometry, frontage count user-defined
 *
 * ADR-186 §8 Q4 (Phase 2 kickoff 2026-05-03): extended from 3 → 6 types.
 * Engines (setback-calculator) only positive-check 'mesaio' / 'diamperes';
 * the 3 new types fall through to the generic multi-frontage logic — safe.
 */
export type PlotType =
  | 'mesaio'
  | 'goniako'
  | 'disgoniaio'
  | 'four_sided'
  | 'diamperes'
  | 'custom';

/**
 * Expropriation (ρυμοτομία) — portion consumed by public road plan.
 * originalArea = area + expropriationArea (derived, informational).
 */
export interface ExpropriationInfo {
  readonly hasExpropriation: boolean;
  readonly area: number; // m² expropriated
}

/** Minimum αρτιότητα limits from zone ordinance — overrides generic ΝΟΚ defaults. */
export interface ArtiotitaRule {
  readonly area_m2: number;
  readonly frontage_m: number;
}

/** Zone-specific αρτιότητα rules from official ordinance or AI-extracted topographic data. */
export interface ArtiotitaRules {
  readonly rule: ArtiotitaRule;
  /** παρέκκλιση — if plot fails rule but passes exception → WARN instead of FAIL */
  readonly exception?: ArtiotitaRule;
}

/** Legal encumbrances on the plot (βάρη, δουλείες). */
export interface EncumbranceInfo {
  readonly hasEncumbrances: boolean;
  readonly details?: string;
}

/**
 * A single plot frontage facing a public street.
 * Each frontage has its own Π (street width) and sidewalk level (Z_κράσπεδο).
 * Max 4 frontages per plot (corner/through plots).
 */
export interface PlotFrontage {
  readonly id: string;
  readonly label: string;               // "Πρόσωπο 1", "Πρόσωπο 2" — auto-assigned
  readonly roadName?: string;           // Οδός — optional, informational
  readonly streetWidth: number;         // Π — πλάτος δρόμου (m)
  readonly sidewalkLevel: number;       // Z_κράσπεδο — αφετηρία μέτρησης ύψους (m abs.)
  readonly sidewalkWidth_m: number;     // Πλάτος πεζοδρομίου (m) — default 2.0
  readonly frontageLength: number;      // μήκος προσώπου (m) — βάρος για ΣΔ_εφαρμ
  readonly syntOverride: number | null; // null = uses PlotSite.synt (zone ΣΔ) — multi-zone only
  readonly RG_isEqualToOG: boolean;     // Ρυμοτομική Γραμμή = Οικοδομική Γραμμή (default: true)
  readonly prassia_m: number;           // Πρασιά (m) — 0 when RG=OG
  readonly oppositeSetback_m: number;   // Πρασιά απέναντι (m) — opposite ΟΓ from opposite ΡΓ
}

/**
 * Όμορο κτίριο — adjacent building on a shared plot boundary.
 * 'south' is never used (south = road side, not a shared boundary).
 */
export interface AdjacentBuilding {
  readonly id: string;
  readonly side: 'north' | 'east' | 'west';
  readonly offsetFromSW_m: number;  // distance along side from SW corner
  readonly width_m: number;         // extent along the shared boundary
  readonly depth_m: number;         // how far it extends into neighbor plot
  readonly height_m: number;
  readonly label?: string;
}

/**
 * Complete plot (site) description.
 * Derived fields are always auto-calculated — never set manually.
 */
export interface PlotSite {
  // Identity
  readonly kaek: string;          // Κτηματολογικός Αριθμός Εθνικού Κτηματολογίου
  readonly address: string;
  readonly municipality: string;
  readonly prefecture?: string;   // Νομός — optional, informational

  // Geometry & building rights
  readonly plotType: PlotType;
  readonly area: number;                       // Εμβαδό δομήσιμο / net (m²) — after expropriation
  readonly perimeter_m?: number;               // Περίμετρος (m) — informational only
  readonly synt: number;                       // ΣΔ ζώνης — zone-level default
  readonly expropriation: ExpropriationInfo;
  readonly frontages: readonly PlotFrontage[]; // 1–4 frontages

  // Planning regime & building constraints
  readonly areaRegime: AreaRegime;
  readonly maxCoveragePct: number;  // Μέγιστη Κάλυψη (%)
  readonly maxHeight: number;       // Μέγιστο ύψος (m)
  readonly zoneName?: string;       // Κωδικός ζώνης (π.χ. "Γ2") — informational
  readonly allowedUses?: readonly string[]; // Επιτρεπόμενες χρήσεις

  /** Zone-specific αρτιότητα rules — if provided, override hardcoded ΝΟΚ defaults in Gate 0. */
  readonly artiotita?: ArtiotitaRules;

  // Legal
  readonly encumbrances?: EncumbranceInfo;

  // ΝΟΚ Bonuses — ν.4067/2012 πολεοδομικά κίνητρα
  readonly bonuses?: BonusSelections;
  readonly nokBonusEligible?: boolean;
  readonly isProtectionZone?: boolean;

  // Urban context — adjacent buildings on shared boundaries
  readonly adjacentBuildings?: readonly AdjacentBuilding[];

  /** Arbitrary polygon outline in local XZ coordinates (m). */
  readonly polyOutline?: readonly [number, number][];
  /**
   * ΕΓΣΑ'87 normalization offset [minEasting, minNorthing] subtracted during import.
   * Defined only when polyOutline was parsed from ΕΓΣΑ'87 source data.
   */
  readonly polyEgsaOffset?: readonly [number, number];
  /**
   * Edge indices mapping polyOutline edges to frontages[].
   * Each entry can be a single edge index OR an array of edge indices (multi-edge frontage).
   */
  readonly polyFrontageEdges?: ReadonlyArray<number | ReadonlyArray<number>>;
  /** Actual opposite ΡΓ polyline in local XZ coordinates (m), normalized by polyEgsaOffset. */
  readonly oppositeRgPolyline?: readonly [number, number][];

  /**
   * True North angle in degrees, clockwise from WCS -Z (Project North).
   * 0 = True North coincides with Project North (default).
   */
  readonly northAngle_deg?: number;

  /**
   * Απόσταση Δ (m) — mandatory rear setback from plot boundary.
   * When undefined, the zone's D_m value is used automatically.
   */
  readonly D_m?: number;

  /**
   * Πλαγία απόσταση δ (m) — mandatory lateral setback from plot boundary.
   * When undefined, the zone's delta_m value is used automatically.
   */
  readonly delta_m?: number;

  // Terrain
  readonly naturalTerrainLevel: number; // ΣΦΕ στο σημείο εισόδου (m, absolute)
  readonly OSE_m: number;               // Ορισμένη Στάθμη Εδάφους (m, absolute)
  readonly slope: TerrainSlope;

  // Derived — auto-calculated by deriveSiteValues(), NEVER set manually
  readonly syntEfarm: number;       // ΣΔ_εφαρμοστέος — weighted average
  readonly maxCoverageM2: number;   // area × maxCoveragePct / 100
  readonly mandatoryOpenM2: number; // Υποχρεωτικός Ακάλυπτος (m²)
  readonly maxBuildableM2: number;  // syntEfarm × area
  readonly originalArea: number;    // area + expropriation.area — Ε_τεμαχίου (informational)
  readonly bonusResult: BonusResult;
  readonly setbackResult: SetbackResult | null;
}

/**
 * Payload for setSite / updateSite store actions.
 * Excludes derived fields — they are always computed automatically.
 */
export type SiteUpdatePayload = Partial<
  Omit<
    PlotSite,
    | 'syntEfarm'
    | 'maxCoverageM2'
    | 'mandatoryOpenM2'
    | 'maxBuildableM2'
    | 'originalArea'
    | 'bonusResult'
    | 'setbackResult'
  >
>;
