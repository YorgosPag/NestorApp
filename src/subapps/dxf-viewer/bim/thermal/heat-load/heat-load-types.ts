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
  /**
   * Αζιμούθιο εξωτερικού normal (deg, 0°=Βορράς, clockwise, [0,360)) — μόνο για
   * εξωτ. κουφώματα προς `external-air` (ADR-422 L7.2 orientation-aware ηλιακά
   * κέρδη). Absent ⇒ orientation-agnostic μέση ακτινοβολία (zero-regression).
   */
  readonly azimuthDeg?: number;
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
  /** m² — εμβαδό δαπέδου (για ειδικό φορτίο W/m² + φορτίο επανέναρξης Φ_RH). */
  readonly floorArea: number;
  readonly boundaries: readonly HeatLoadBoundary[];
  /**
   * W/m²K — προσαύξηση θερμογεφυρών `ΔU_TB` (απλοποιημένη μέθοδος EN 12831-1
   * §6.3.2: `U_corr = U + ΔU_TB`). Εφαρμόζεται μόνο σε αδιαφανή στοιχεία
   * περιβλήματος προς εξωτ. αέρα/έδαφος. Absent/0 ⇒ καμία προσαύξηση (default).
   */
  readonly thermalBridgeSurchargeWperM2K?: number;
  /**
   * W/m² — συντελεστής επανέναρξης `f_RH` (EN 12831: `Φ_RH = A_floor · f_RH`).
   * Absent/0 ⇒ συνεχής λειτουργία, μηδέν επιπλέον φορτίο (default).
   */
  readonly reheatFactorWperM2?: number;
}

/** Απώλεια αγωγής μιας οριακής επιφάνειας (breakdown). */
export interface BoundaryHeatLoss {
  readonly kind: HeatLoadBoundaryKind;
  readonly condition: BoundaryCondition;
  readonly uValue: number;
  readonly area: number;
  /** Μειωτικός συντελεστής `b` που εφαρμόστηκε. */
  readonly factor: number;
  /** W — U_corr·A·b·ΔΤ (περιλαμβάνει τυχόν προσαύξηση θερμογέφυρας). */
  readonly lossW: number;
  /**
   * W — μέρος του `lossW` που οφείλεται στη θερμογέφυρα `ΔU_TB·A·b·ΔΤ`
   * (πληροφοριακό υποσύνολο· 0 αν το στοιχείο δεν λαμβάνει προσαύξηση).
   */
  readonly thermalBridgeW: number;
  readonly refId?: string;
  /**
   * Αζιμούθιο εξωτερικού normal (deg, 0°=Βορράς, clockwise) — propagated από το
   * `HeatLoadBoundary` για orientation-aware ηλιακά κέρδη (ADR-422 L7.2). Absent ⇒
   * μέση ακτινοβολία. ΔΕΝ επηρεάζει τον υπολογισμό φορτίου (μόνο τα ηλιακά κέρδη).
   */
  readonly azimuthDeg?: number;
}

/** Αποτέλεσμα υπολογισμού φορτίου ενός χώρου (`Φ` + breakdown). */
export interface SpaceHeatLoadResult {
  readonly spaceId: string;
  /** °C — ΔΤ βάσης (Ti − Te). */
  readonly deltaTC: number;
  /** W — απώλειες αγωγής Σ U_corr·A·b·ΔΤ (περιλαμβάνει θερμογέφυρες). */
  readonly transmissionW: number;
  /** W — απώλειες αερισμού 0.34·n·V·ΔΤ. */
  readonly ventilationW: number;
  /**
   * W — μέρος του `transmissionW` που οφείλεται στις θερμογέφυρες
   * (Σ ΔU_TB·A·b·ΔΤ). Πληροφοριακό υποσύνολο — ΟΧΙ ξανα-προστίθεται στο `totalW`.
   */
  readonly thermalBridgeW: number;
  /** W — φορτίο επανέναρξης Φ_RH = A_floor · f_RH (0 για συνεχή λειτουργία). */
  readonly reheatW: number;
  /** W — συνολικό θερμικό φορτίο `Φ` = transmission + ventilation + reheat. */
  readonly totalW: number;
  /** W/m² — ειδικό θερμικό φορτίο (Φ / εμβαδό δαπέδου). */
  readonly specificLoadWperM2: number;
  readonly boundaries: readonly BoundaryHeatLoss[];
}
