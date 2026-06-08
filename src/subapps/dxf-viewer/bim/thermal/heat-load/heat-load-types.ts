/**
 * ADR-422 L1 — Heat-Load engine type schema (EN 12831 / ΤΟΤΕΕ 20701-1).
 *
 * Pure data contracts για τον υπολογισμό θερμικού φορτίου `Φ` (W) ανά θερμικό
 * χώρο. Ο διαχωρισμός είναι σκόπιμος (FULL SSOT):
 *   - `SpaceHeatLoadInput` = **resolved** οριακές συνθήκες (U/A/condition) +
 *     θερμοκρασίες/αερισμός. ΚΑΜΙΑ γνώση scene/geometry — το παράγει ο resolver
 *     (`space-boundary-resolver`).
 *   - `computeSpaceHeatLoad(input)` (`heat-load-engine`) = καθαρή αριθμητική,
 *     full unit-testable με ΤΟΤΕΕ worked examples.
 *   - `SpaceHeatLoadResult` = το `Φ` + breakdown (αγωγή/αερισμός/ανά στοιχείο +
 *     ειδικό φορτίο W/m²) για UI + report.
 *
 * @see ./heat-load-engine (computeSpaceHeatLoad — pure math)
 * @see ./space-boundary-resolver (παράγει το input από το scene)
 * @see ./heat-load-config (b-factors) · ../kenak-thermal-config (Te ανά ζώνη)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

/**
 * Οριακή συνθήκη ενός δομικού στοιχείου — καθορίζει τον μειωτικό συντελεστή `b`
 * (temperature adjustment) μέσω `BOUNDARY_TEMPERATURE_FACTOR`:
 *   - `external-air`    — συνορεύει με εξωτ. αέρα (b=1): εξωτ. τοίχος/κούφωμα/στέγη/piloti.
 *   - `ground`          — επί εδάφους (b≈0.5): πλάκα ισογείου σε επαφή με έδαφος.
 *   - `unheated`        — μη θερμαινόμενος γειτονικός χώρος (b≈0.5).
 *   - `adjacent-heated` — γειτονικός θερμαινόμενος χώρος (b=0, μηδέν απώλεια).
 */
export type BoundaryCondition =
  | 'external-air'
  | 'ground'
  | 'unheated'
  | 'adjacent-heated';

/**
 * Τύπος δομικού στοιχείου της οριακής επιφάνειας (για ομαδοποίηση/UI/report).
 * Δεν επηρεάζει τον υπολογισμό — αυτός εξαρτάται μόνο από `uValue`/`area`/`condition`.
 */
export type HeatLoadBoundaryKind =
  | 'wall'
  | 'window'
  | 'door'
  | 'floor'
  | 'roof'
  | 'ceiling';

/**
 * Μία οριακή επιφάνεια του χώρου (resolved). `uValue` σε W/m²K, `area` σε m².
 * `refId` = προαιρετικό entity id πηγής (traceability/report).
 */
export interface HeatLoadBoundary {
  readonly kind: HeatLoadBoundaryKind;
  readonly condition: BoundaryCondition;
  /** W/m²K. */
  readonly uValue: number;
  /** m². Καθαρή επιφάνεια (κουφώματα ήδη αφαιρεμένα από τον τοίχο). */
  readonly area: number;
  /** Προαιρετικό entity id πηγής (π.χ. wall/opening id) για traceability. */
  readonly refId?: string;
}

/** Resolved input για τον υπολογισμό φορτίου ενός χώρου. */
export interface SpaceHeatLoadInput {
  readonly spaceId: string;
  /** °C — εσωτερική θερμοκρασία σχεδιασμού Ti. */
  readonly indoorTempC: number;
  /** °C — εξωτερική θερμοκρασία σχεδιασμού Te (κλιματική ζώνη). */
  readonly outdoorTempC: number;
  /** 1/h — εναλλαγές αέρα n. */
  readonly airChangesPerHour: number;
  /** m³ — όγκος χώρου (για απώλειες αερισμού). */
  readonly volume: number;
  /** m² — εμβαδό δαπέδου (για ειδικό φορτίο W/m²). */
  readonly floorArea: number;
  readonly boundaries: readonly HeatLoadBoundary[];
}

/** Απώλεια αγωγής μιας οριακής επιφάνειας (breakdown). */
export interface BoundaryHeatLoss {
  readonly kind: HeatLoadBoundaryKind;
  readonly condition: BoundaryCondition;
  readonly uValue: number;
  readonly area: number;
  /** Μειωτικός συντελεστής `b` που εφαρμόστηκε. */
  readonly factor: number;
  /** W — U·A·b·ΔΤ. */
  readonly lossW: number;
  readonly refId?: string;
}

/** Αποτέλεσμα υπολογισμού φορτίου ενός χώρου (`Φ` + breakdown). */
export interface SpaceHeatLoadResult {
  readonly spaceId: string;
  /** °C — ΔΤ βάσης (Ti − Te). */
  readonly deltaTC: number;
  /** W — απώλειες αγωγής Σ U·A·b·ΔΤ. */
  readonly transmissionW: number;
  /** W — απώλειες αερισμού 0.34·n·V·ΔΤ. */
  readonly ventilationW: number;
  /** W — συνολικό θερμικό φορτίο `Φ`. */
  readonly totalW: number;
  /** W/m² — ειδικό θερμικό φορτίο (Φ / εμβαδό δαπέδου). */
  readonly specificLoadWperM2: number;
  readonly boundaries: readonly BoundaryHeatLoss[];
}
