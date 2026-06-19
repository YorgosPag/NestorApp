/**
 * Structural Organism — Analytical Connectivity Model types (ADR-459, Phase 0).
 *
 * Το «Structural Organism» αντιμετωπίζει τις συνδεδεμένες δομικές οντότητες
 * (πέδιλο → κολόνα → δοκάρι) ως **ΕΝΑΝ** στατικό οργανισμό αντί για μεμονωμένα
 * στοιχεία — αντίστοιχο του Revit Analytical Model + Structural Connectivity.
 *
 * Ο graph είναι **DERIVED, ΠΟΤΕ persisted** (φιλοσοφία `displayOutline` /
 * `displayAxisPolyline`, ADR-458): re-derived από τα ΥΠΑΡΧΟΝΤΑ FKs/geometry σε
 * κάθε structural αλλαγή σκηνής. SSoT = τα params των entities· ο graph είναι
 * παράγωγο cache πάνω τους.
 *
 * Pure type module — zero runtime logic, zero React/DOM/Firestore deps.
 *
 * @see structural-graph.ts — ο builder
 * @see organism-checks.ts — οι cross-entity έλεγχοι (Phase 1)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md
 */

/** Plan-space σημείο (canvas units — ίδιο space με footprints/άξονες). */
export interface OrganismPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Είδος δομικού μέλους στον οργανισμό (Phase 0 scope). `footing` καλύπτει ΚΑΙ τα
 * `FoundationEntity` (pad/strip/tie-beam) ΚΑΙ τις πλάκες-θεμελίωσης (raft/εδαφό-
 * πλακα, `SlabEntity` kind foundation/ground) — όλα παρέχουν έδραση από κάτω.
 */
export type StructuralMemberKind = 'footing' | 'column' | 'beam';

/** Underlying entity type ενός node (metadata — διαφοροποιεί footing-slab από footing). */
export type StructuralMemberEntityType =
  | 'foundation'
  | 'foundation-slab'
  | 'column'
  | 'beam';

/** Άξονας γραμμικού μέλους (δοκάρι) σε canvas units + μισό πλάτος σε canvas units. */
export interface StructuralMemberAxis {
  readonly start: OrganismPoint;
  readonly end: OrganismPoint;
  /** Μισό πλάτος διατομής (canvas units) — για endpoint-coverage tests. */
  readonly halfWidth: number;
}

/**
 * Κόμβος του οργανισμού = ΕΝΑ δομικό μέλος. `id` = entity id (SSoT FK προς το
 * persisted entity). Geometry summary (footprint/axis + Z extents) κρατιέται εδώ
 * ώστε οι έλεγχοι να τρέχουν αμιγώς πάνω στον graph (μηδέν re-fetch entities).
 */
export interface StructuralNode {
  readonly id: string;
  readonly memberKind: StructuralMemberKind;
  readonly entityType: StructuralMemberEntityType;
  /** Plan footprint (closed polygon, canvas units) — columns & footings. */
  readonly footprint?: readonly OrganismPoint[];
  /** Άξονας (canvas units) — beams. */
  readonly axis?: StructuralMemberAxis;
  /** Beam-only: support condition (cantilever ⇒ θεμιτό ελεύθερο άκρο). */
  readonly supportType?: 'simple' | 'fixed' | 'cantilever';
  /**
   * Column-only (ADR-459 Phase 2): αναλυτικό FK προς το footing node που στηρίζει
   * τη βάση (`ColumnParams.footingId`). Όταν υπάρχει & δείχνει σε υπαρκτό footing
   * node → η `footing-bearing` ακμή παράγεται ΑΠΟ ΑΥΤΟ (explicit-FK-wins)· αλλιώς
   * spatial-coincidence fallback. Absent = legacy/μη-attached.
   */
  readonly footingId?: string;
  /** Absolute mm — κάτω παρειά (base) του μέλους. */
  readonly baseZmm: number;
  /** Absolute mm — άνω παρειά (top) του μέλους. */
  readonly topZmm: number;
}

/**
 * Είδος σύνδεσης (ακμή). Η κατεύθυνση είναι load-path: `supportId` = κάτω/στηρίζον
 * μέλος, `supportedId` = άνω/στηριζόμενο.
 *   - `footing-bearing` → πέδιλο/εδαφόπλακα στηρίζει τη βάση κολόνας.
 *   - `column-bearing`  → κολόνα στηρίζει δοκάρι (framing into).
 *   - `top-attachment`  → κορυφή μέλους attached σε host από πάνω (FK attachTopToIds).
 */
export type StructuralConnectionKind =
  | 'footing-bearing'
  | 'column-bearing'
  | 'top-attachment';

/** Ακμή του οργανισμού = μία στατική σύνδεση μεταξύ δύο nodes. */
export interface StructuralEdge {
  /** Stable id `${supportId}->${supportedId}:${kind}` (dedup/keys). */
  readonly id: string;
  /** Κάτω / στηρίζον μέλος. */
  readonly supportId: string;
  /** Άνω / στηριζόμενο μέλος. */
  readonly supportedId: string;
  readonly kind: StructuralConnectionKind;
}

/** Ο πλήρης στατικός οργανισμός ενός ορόφου (DERIVED). */
export interface StructuralGraph {
  readonly nodes: readonly StructuralNode[];
  readonly edges: readonly StructuralEdge[];
}

// ─── Diagnostics (Phase 1 — cross-entity validation) ─────────────────────────

export type StructuralDiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * Σταθεροί κωδικοί ελέγχων (map σε i18n keys στο `organism-checks` /
 * `reinforcement-checks`). Phase 0-1 = geometry connectivity· Phase 4d =
 * reinforcement διαγνωστικά (οπλισμός μέλους / ρ εκτός ορίων / αναντιστοιχία κόμβου).
 */
export type StructuralDiagnosticCode =
  | 'columnMissingFooting'
  | 'beamUnsupportedEnd'
  | 'memberIsolated'
  | 'memberMissingReinforcement'
  | 'ratioOutOfRange'
  | 'barMismatchAtJoint'
  | 'columnTopAnchorageUnverified'
  // ADR-464 — footing design checks (loads model).
  | 'bearingInadequate'
  | 'padEccentricHogging'
  | 'punchingInadequate'
  | 'oneWayShearInadequate'
  // ADR-480 — analytical model diagnostics (T2).
  | 'analyticalMemberUnsupported'
  | 'analyticalModelUnstable'
  // ADR-481 — static FEM solver diagnostics (T3).
  | 'staticAnalysisUnstable'
  | 'staticAnalysisMemberSkipped'
  // ADR-498 — cantilever slab design.
  | 'cantileverSlabTooThin'
  // ADR-499 §C — beam torsion from one-sided cantilever slab.
  | 'beamCantileverTorsionExceedsCapacity'
  // ADR-499 §D — global feasibility: μέλος ανέφικτο στο πρακτικό μέγιστο μέγεθος (error).
  | 'sectionInfeasibleAtMaxSize'
  // ADR-504 §Φ1 — practical-span advisory: μη-πρακτικά βαθιά δοκός (κόβει καθαρό ύψος) →
  // πρόταση ενδιάμεσων κολωνών (soft warning, opt-in).
  | 'beamSpanImpractical';

/**
 * Ένα cross-entity εύρημα. `primaryEntityId` = το μέλος που «φταίει» (οδηγεί το
 * per-entity panel surfacing)· `entityIds` = όλα τα εμπλεκόμενα (για highlight).
 * `messageKey` = i18n key (ns `dxf-viewer-shell`) — μηδέν hardcoded strings (N.11).
 * `messageParams` = προαιρετικά ICU placeholders (π.χ. ρ%/όρια) που περνούν στο
 * `t(messageKey, params)` — DERIVED τιμές, ΟΧΙ μεταφρασμένα strings (N.11-safe).
 */
export interface StructuralDiagnostic {
  readonly id: string;
  readonly code: StructuralDiagnosticCode;
  readonly severity: StructuralDiagnosticSeverity;
  readonly messageKey: string;
  readonly primaryEntityId: string;
  readonly entityIds: readonly string[];
  readonly messageParams?: Readonly<Record<string, string | number>>;
}
