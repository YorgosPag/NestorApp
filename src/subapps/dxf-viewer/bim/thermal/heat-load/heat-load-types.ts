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
  /**
   * Συντελεστής σκίασης οριζόντιου προβόλου `F_ov` ∈ (0,1] — geometry-derived
   * per-window (ADR-422 L7.3 Slice B, EN ISO 13790 §11.4.4). Μόνο για εξωτ.
   * κουφώματα κάτω από ανιχνεύσιμο πρόβολο· πολλαπλασιάζεται με το manual
   * `obstruction` του χώρου στα ηλιακά κέρδη. **Absent ⇒ 1.0 (zero-regression).**
   */
  readonly overhangShadingFactor?: number;
  /**
   * Συντελεστής σκίασης **πλευρικού πτερυγίου** `F_fin` ∈ (0,1] — geometry-derived
   * per-window από τους κάθετους τοίχους/παραστάδες δίπλα στο παράθυρο (ADR-422 L7.3
   * Slice D, EN ISO 13790 §11.4.4). Μόνο για εξωτ. παράθυρα με ανιχνεύσιμο κάθετο
   * πτερύγιο· **υπερισχύει** του manual `finShadingLevel` του χώρου (Slice C) στα
   * ηλιακά κέρδη (`finShadingFactor ?? getFinShadingFactor(level)` — όχι multiply,
   * ίδιο φυσικό εμπόδιο). **Absent ⇒ fallback Slice C ⇒ zero-regression.**
   */
  readonly finShadingFactor?: number;
  /**
   * Συντελεστής σκίασης **ορίζοντα** `F_hor` ∈ (0,1] — geometry-derived per-window
   * από τις **μάζες γειτονικών κτιρίων** (ray-cast κατά τον outward normal, γωνία
   * ανύψωσης `α_hor`· ADR-422 L7.3 Slice E, EN ISO 13790 §11.4.4· ADR-369 site
   * placement). Μόνο για εξωτ. παράθυρα με ανιχνεύσιμη μάζα ορίζοντα· **υπερισχύει**
   * του manual `horizonShadingLevel` του χώρου (Slice C) στα ηλιακά κέρδη
   * (`horizonShadingFactor ?? getHorizonShadingFactor(level)` — όχι multiply, ίδιο
   * φυσικό εμπόδιο). **Absent ⇒ fallback Slice C ⇒ zero-regression.**
   */
  readonly horizonShadingFactor?: number;
  /**
   * Ολικός συντελεστής ηλιακής διαπερατότητας υαλοπίνακα `g` (SHGC, αδιάστατο) —
   * per-window από τον αριθμό υαλοπινάκων (ADR-422 L7.4, EN 410 / ΤΟΤΕΕ 20701-1).
   * Μόνο για εξωτ. παράθυρα· οδηγεί τα ηλιακά κέρδη (`A·g·F_F·F_sh·…`). **Absent ⇒
   * `GLAZING_SOLAR_FACTOR_G` (0.60, διπλό) ⇒ zero-regression.**
   */
  readonly solarFactorG?: number;
  /**
   * Γεωμετρικός συντελεστής πλαισίου `F_F = A_glass/A_opening` ∈ (0,1] — per-window
   * από `(W−2f)(H−2f)/(W·H)` (ADR-422 L7.5, EN ISO 13790 §11.3.2). Μόνο για εξωτ.
   * παράθυρα **με ρητό `frameWidth`**· οδηγεί τα ηλιακά κέρδη (`A·g·F_F·F_sh·…`).
   * **Absent ⇒ `FRAME_FACTOR` (0.70) ⇒ zero-regression** (absent-anchor: το
   * γεωμετρικό default frameWidth δεν δίνει 0.70, άρα υπολογίζεται ΜΟΝΟ όταν ρητό).
   */
  readonly frameFactorF?: number;
  /**
   * Ηλιακή απορροφητικότητα `α_S` ∈ (0,1) της εξωτ. αδιαφανούς επιφάνειας (από την
   * per-space απόχρωση, ADR-422 L7.6, EN ISO 13790 §11.3.4). Μόνο για εξωτ. **τοίχους**
   * προς `external-air`· οδηγεί τα ηλιακά κέρδη αδιαφανών στοιχείων (`A·α·R_se·U·…`).
   * **Absent ⇒ `getSolarAbsorptance('medium')` (0.60) ⇒ default** (ο τοίχος πάντα
   * απορροφά κάτι· zero-regression έρχεται από το window-only φιλτράρισμα του aggregator).
   */
  readonly solarAbsorptance?: number;
  /**
   * Επιφανειακή θερμοχωρητικότητα `κ_m = Σ ρ·c·d_eff` (J/m²K) της αδιαφανούς διάταξης —
   * geometry-derived από τα στρώματα του assembly (ADR-422 L7.9-B, EN ISO 13790 §12.3.1.1).
   * Μόνο για **τοίχους** με resolvable `WallDna` (δάπεδα/στέγες/κουφώματα = absent v1)·
   * ο aggregator το αθροίζει `Σ κ_m·A` → εσωτερική θερμοχωρητικότητα `C_m` του χώρου
   * (precedence πάνω από την κατηγορία `thermalMassLevel` του L7.9). **Absent ⇒ fallback
   * κατηγορία/absent ⇒ zero-regression** (custom/άγνωστα υλικά → χωρίς resolvable μάζα).
   */
  readonly arealHeatCapacityJperM2K?: number;
  /**
   * Override του μειωτικού συντελεστή θερμοκρασίας `b` ενός δαπέδου **επί εδάφους**
   * (ADR-422 L1.6, EN ISO 13370). Όταν στάμπεται (=1.0), το `uValue` κουβαλά το
   * effective `U_g` (floor-to-external, ενσωματώνει τη διαδρομή εδάφους) → εφαρμόζεται
   * με πλήρες ΔΤ αντί του geometry-blind flat `b≈0.5`. Η παρουσία του σηματοδοτεί επίσης
   * 13370-coupled boundary → ο engine **εξαιρεί** το blanket `ΔU_TB` (το `U_g` ήδη
   * περιλαμβάνει γεωμετρικά τον edge effect — αποφυγή διπλομέτρησης). **Absent ⇒
   * `getBoundaryTemperatureFactor(condition)` (flat) + κανονικό ΔU_TB ⇒ zero-regression.**
   */
  readonly groundTemperatureFactor?: number;
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
  /**
   * 1/h — ρυθμός **διείσδυσης** `n_inf = 2·n50·e·ε` (EN 12831-1 §6.3.3, ADR-422 L1.7).
   * Πληροφοριακό σκέλος του αερισμού — ο engine το αποτυπώνει ως `infiltrationW`
   * (`0.34·n_inf·V·ΔΤ`) χωρίς να το προσθέτει ξανά στο `totalW` (το κυρίαρχο σκέλος
   * περνά ήδη μέσω του `airChangesPerHour=n_eff`). **Absent ⇒ 0 ⇒ zero-regression.**
   */
  readonly infiltrationAch?: number;
  /**
   * 1/h — **σχεδιασμένος** ρυθμός αερισμού `n_ven = n_min·(1−η)` (EN 12831-1 §6.3.3,
   * ADR-422 L1.7). Πληροφοριακό σκέλος — ο engine το αποτυπώνει ως `designedVentilationW`
   * (`0.34·n_ven·V·ΔΤ`). **Absent ⇒ 0 ⇒ zero-regression.**
   */
  readonly designedVentilationAch?: number;
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
  /**
   * Συντελεστής σκίασης οριζόντιου προβόλου `F_ov` ∈ (0,1] — propagated από το
   * `HeatLoadBoundary` (ADR-422 L7.3 Slice B). Absent ⇒ 1.0. ΔΕΝ επηρεάζει το
   * φορτίο — μόνο τα ηλιακά κέρδη (`derive-annual-energy`).
   */
  readonly overhangShadingFactor?: number;
  /**
   * Συντελεστής σκίασης πλευρικού πτερυγίου `F_fin` ∈ (0,1] — propagated από το
   * `HeatLoadBoundary` (ADR-422 L7.3 Slice D). Absent ⇒ fallback manual `finShadingLevel`
   * (Slice C). ΔΕΝ επηρεάζει το φορτίο — μόνο τα ηλιακά κέρδη (`derive-annual-energy`).
   */
  readonly finShadingFactor?: number;
  /**
   * Συντελεστής σκίασης ορίζοντα `F_hor` ∈ (0,1] — propagated από το `HeatLoadBoundary`
   * (ADR-422 L7.3 Slice E). Absent ⇒ fallback manual `horizonShadingLevel` (Slice C).
   * ΔΕΝ επηρεάζει το φορτίο — μόνο τα ηλιακά κέρδη (`derive-annual-energy`).
   */
  readonly horizonShadingFactor?: number;
  /**
   * Συντελεστής ηλιακής διαπερατότητας υαλοπίνακα `g` (SHGC) — propagated από το
   * `HeatLoadBoundary` (ADR-422 L7.4). Absent ⇒ `GLAZING_SOLAR_FACTOR_G` (0.60).
   * ΔΕΝ επηρεάζει το φορτίο — μόνο τα ηλιακά κέρδη (`derive-annual-energy`).
   */
  readonly solarFactorG?: number;
  /**
   * Γεωμετρικός συντελεστής πλαισίου `F_F` ∈ (0,1] — propagated από το
   * `HeatLoadBoundary` (ADR-422 L7.5). Absent ⇒ `FRAME_FACTOR` (0.70). ΔΕΝ
   * επηρεάζει το φορτίο — μόνο τα ηλιακά κέρδη (`derive-annual-energy`).
   */
  readonly frameFactorF?: number;
  /**
   * Ηλιακή απορροφητικότητα `α_S` αδιαφανούς εξωτ. τοίχου — propagated από το
   * `HeatLoadBoundary` (ADR-422 L7.6). Absent ⇒ `getSolarAbsorptance('medium')`
   * (0.60). ΔΕΝ επηρεάζει το φορτίο — μόνο τα ηλιακά κέρδη (`derive-annual-energy`).
   */
  readonly solarAbsorptance?: number;
  /**
   * Επιφανειακή θερμοχωρητικότητα `κ_m` (J/m²K) — propagated από το `HeatLoadBoundary`
   * (ADR-422 L7.9-B). Absent ⇒ χωρίς geometry-derived μάζα (fallback κατηγορία). ΔΕΝ
   * επηρεάζει το φορτίο — μόνο τη δυναμική αξιοποίηση κερδών (`derive-annual-energy`).
   */
  readonly arealHeatCapacityJperM2K?: number;
  /**
   * Override συντελεστή `b` δαπέδου επί εδάφους (EN ISO 13370, ADR-422 L1.6) —
   * propagated από το `HeatLoadBoundary`. Παρόν (=1.0) ⇒ το `factor`/`uValue` αυτής
   * της επιφάνειας προέρχεται από το 13370 `U_g`. Absent ⇒ flat `b`. Πληροφοριακό
   * (το εφαρμοσμένο `b` είναι ήδη στο `factor`).
   */
  readonly groundTemperatureFactor?: number;
}

/** Αποτέλεσμα υπολογισμού φορτίου ενός χώρου (`Φ` + breakdown). */
export interface SpaceHeatLoadResult {
  readonly spaceId: string;
  /** °C — ΔΤ βάσης (Ti − Te). */
  readonly deltaTC: number;
  /** W — απώλειες αγωγής Σ U_corr·A·b·ΔΤ (περιλαμβάνει θερμογέφυρες). */
  readonly transmissionW: number;
  /** W — απώλειες αερισμού 0.34·n_eff·V·ΔΤ = max(infiltrationW, designedVentilationW). */
  readonly ventilationW: number;
  /**
   * W — σκέλος **διείσδυσης** του αερισμού `0.34·n_inf·V·ΔΤ` (EN 12831-1 §6.3.3,
   * ADR-422 L1.7/L1.8). Πληροφοριακό υποσύνολο — ΟΧΙ ξανα-προστίθεται στο `totalW`
   * (το `ventilationW=max(...)` που μπαίνει στο σύνολο είναι το κυρίαρχο σκέλος).
   * Absent split στο input ⇒ 0 (zero-regression).
   */
  readonly infiltrationW: number;
  /**
   * W — σκέλος **σχεδιασμένου** αερισμού `0.34·n_ven·V·ΔΤ` (EN 12831-1 §6.3.3,
   * ADR-422 L1.7/L1.8). Πληροφοριακό υποσύνολο — ΟΧΙ ξανα-προστίθεται στο `totalW`.
   * Absent split στο input ⇒ 0 (zero-regression).
   */
  readonly designedVentilationW: number;
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
