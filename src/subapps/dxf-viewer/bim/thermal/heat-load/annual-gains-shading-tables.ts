/**
 * ADR-422 L7.3 — Πίνακες σκίασης υαλοπινάκων: orientation-aware shading tables SSoT.
 *
 * Εξαγωγή από `annual-gains-config.ts` (surgical split για ≤500 γραμμές/αρχείο).
 * Περιέχει αποκλειστικά **pure data tables + interpolation helpers** για τη σκίαση:
 *   - L7.3 Slice B: Οριζόντιος πρόβολος (`OVERHANG_SHADING_FACTOR`, `getOverhangShadingFactor`)
 *   - L7.3 Slice C: Ορίζοντας (`HORIZON_SHADING_FACTOR`, `getHorizonShadingFactor`) +
 *                   Πλευρικά πτερύγια level-based (`FIN_SHADING_FACTOR`, `getFinShadingFactor`)
 *   - L7.3 Slice D: Geometry-derived πτερύγια (`FIN_GEOMETRY_SHADING_FACTOR`, `getFinGeometryShadingFactor`)
 *
 * Καμία εξωτερική εξάρτηση (standalone) — ορίζει επίσης `SolarOrientation` / `SOLAR_ORIENTATIONS`
 * που re-export-άρονται από `annual-gains-config`. Ο engine + ο aggregator διαβάζουν τα
 * exports απευθείας (zero API change — το `annual-gains-config` re-exports τα πάντα).
 *
 * @see ./annual-gains-config (κύριο SSoT — re-exports από εδώ)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.3)
 */

// ─── Orientation types (standalone — re-exported verbatim από annual-gains-config) ──

/**
 * Προσανατολισμός κατακόρυφης επιφάνειας — 8 σημεία πυξίδας (Revit Energy / ΤΟΤΕΕ
 * 20701-1 parity). 0°=Βορράς, **clockwise**. ADR-422 L7.2.
 */
export type SolarOrientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** Οι 8 προσανατολισμοί σε σειρά πυξίδας (Β στις 0°, clockwise) — index 0..7. */
export const SOLAR_ORIENTATIONS: readonly SolarOrientation[] = [
  'N',
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW',
];

// ─── Κοινά private helpers (shared Slice B + D) ───────────────────────────────

/** Σημείο πίνακα προβόλου: γωνία προβόλου (deg) → συντελεστής σκίασης `F_ov`. */
export interface OverhangShadingBand {
  /** Γωνία προβόλου `β = atan(d_ov/h_top)` σε μοίρες (αύξουσα σειρά). */
  readonly angle: number;
  /** Συντελεστής σκίασης `F_ov` ∈ (0,1] στη γωνία αυτή. */
  readonly factor: number;
}

/** Κάτω όριο του `F_ov`/`F_fin` (αποφυγή μηδενικού/αρνητικού — διατηρεί `∈ (0,1]`). */
const PROJECTION_FACTOR_FLOOR = 0.01;

/**
 * Γραμμική interpolation συντελεστή σκίασης από έναν angle-banded πίνακα (γωνία deg →
 * factor, αύξουσα σειρά γωνιών). `angleDeg ≤ 0` ⇒ `1.0` (καμία σκίαση, zero-regression)·
 * `angleDeg` πέρα από την τελευταία γωνία ⇒ ο τελευταίος συντελεστής (clamp). Αποτέλεσμα
 * clamped `∈ (0,1]`. **SSoT helper** των geometry-derived σκιάσεων προβόλου (`F_ov`,
 * Slice B) & πλευρικού πτερυγίου (`F_fin`, Slice D) — μία interpolation μηχανή. Pure.
 */
function interpolateOrientationBands(
  bands: readonly OverhangShadingBand[],
  angleDeg: number,
): number {
  if (!(angleDeg > 0)) return 1;
  let result = bands[bands.length - 1].factor;
  for (let i = 0; i < bands.length - 1; i++) {
    const lo = bands[i];
    const hi = bands[i + 1];
    if (angleDeg <= hi.angle) {
      const span = hi.angle - lo.angle;
      const tt = span > 0 ? (angleDeg - lo.angle) / span : 0;
      result = lo.factor + tt * (hi.factor - lo.factor);
      break;
    }
  }
  return Math.min(1, Math.max(PROJECTION_FACTOR_FLOOR, result));
}

/** Μέσος όρος των 8 προσανατολισμών ενός shading record (orientation-agnostic fallback). */
function orientationAgnosticMean(byOrientation: Record<SolarOrientation, number>): number {
  const sum = SOLAR_ORIENTATIONS.reduce((s, o) => s + byOrientation[o], 0);
  return sum / SOLAR_ORIENTATIONS.length;
}

// ─── L7.3 Slice B — Συντελεστής σκίασης οριζόντιου προβόλου (F_ov) ─────────────

/**
 * Συντελεστής σκίασης **οριζόντιου προβόλου** `F_ov` ∈ (0,1] ανά **προσανατολισμό**
 * και **γωνία προβόλου** `β` — EN ISO 13790 §11.4.4 / ΤΟΤΕΕ 20701-1 (πίνακες
 * σκίασης προβόλων), αντιπροσωπευτικές documented defaults (editable). Φυσική:
 *   - **Νότιος = μεγαλύτερη μείωση** — ο χαμηλός χειμερινός νότιος ήλιος κόβεται
 *     εύκολα από οριζόντιο πρόβολο.
 *   - **Βόρειος ≈ 1.0** — μόνο διάχυτη ακτινοβολία, ο πρόβολος ελάχιστα την κόβει.
 *   - Α/Δ ενδιάμεσα· ΝΑ/ΝΔ κοντά στον Ν· ΒΑ/ΒΔ κοντά στον Β.
 * `β=0` (κανένας πρόβολος) ⇒ `1.0` παντού ⇒ zero-regression. Γραμμική interpolation
 * μεταξύ γωνιών (βλ. `getOverhangShadingFactor`). SSoT — ο resolver διαβάζει ΜΟΝΟ από εδώ.
 */
export const OVERHANG_SHADING_FACTOR: Readonly<
  Record<SolarOrientation, readonly OverhangShadingBand[]>
> = {
  S:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.88 }, { angle: 45, factor: 0.72 }, { angle: 60, factor: 0.55 }],
  SE: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.90 }, { angle: 45, factor: 0.76 }, { angle: 60, factor: 0.60 }],
  SW: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.90 }, { angle: 45, factor: 0.76 }, { angle: 60, factor: 0.60 }],
  E:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.93 }, { angle: 45, factor: 0.83 }, { angle: 60, factor: 0.70 }],
  W:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.93 }, { angle: 45, factor: 0.83 }, { angle: 60, factor: 0.70 }],
  NE: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.97 }, { angle: 45, factor: 0.92 }, { angle: 60, factor: 0.85 }],
  NW: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.97 }, { angle: 45, factor: 0.92 }, { angle: 60, factor: 0.85 }],
  N:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.99 }, { angle: 45, factor: 0.97 }, { angle: 60, factor: 0.94 }],
};

/**
 * Συντελεστής σκίασης οριζόντιου προβόλου `F_ov` για γωνία προβόλου `β` (deg) και
 * προσανατολισμό — **γραμμική interpolation** στις γωνίες του `OVERHANG_SHADING_FACTOR`.
 * `β ≤ 0` ⇒ `1.0` (κανένας πρόβολος, zero-regression)· `β` πέρα από την τελευταία
 * γωνία ⇒ ο τελευταίος συντελεστής (clamp). Αποτέλεσμα clamped `∈ (0,1]`. Pure.
 */
export function getOverhangShadingFactor(angleDeg: number, orientation: SolarOrientation): number {
  return interpolateOrientationBands(OVERHANG_SHADING_FACTOR[orientation], angleDeg);
}

// ─── L7.3 Slice C — Ορίζοντας (F_hor) + πλευρικά πτερύγια (F_fin) ───────────────

/**
 * Επίπεδο σκίασης υαλοπίνακα από **μακρινό ορίζοντα** (γειτονικά κτίρια / λόφοι /
 * skyline) — ο discriminator του συντελεστή `F_hor` της EN ISO 13790 §11.4.4 /
 * ΤΟΤΕΕ 20701-1 (πίνακες σκίασης ορίζοντα). Ο μακρινός ορίζοντας κόβει τον **χαμηλό
 * χειμερινό ήλιο** → ο **Νότος** επηρεάζεται περισσότερο, ο Βορράς ελάχιστα (μόνο
 * διάχυτη). Ξεχωριστός orientation-aware όρος του triad `F_sh,gl = F_hor·F_ov·F_fin`·
 * πολλαπλασιάζεται με το generic obstruction (L7.3 v1) & το geometry `F_ov` (Slice B).
 * Default χώρου `none` (1.0 ⇒ zero-regression). Mirror του `SolarShadingLevel`.
 */
export type HorizonShadingLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * Συντελεστής σκίασης ορίζοντα `F_hor` ∈ (0,1] ανά **επίπεδο** και **προσανατολισμό**
 * — EN ISO 13790 §11.4.4 / ΤΟΤΕΕ 20701-1 αντιπροσωπευτικές documented defaults
 * (φθίνον με την ένταση· **Νότος μέγιστη μείωση** χαμηλού χειμερινού ήλιου, Βορράς
 * ελάχιστη· συμμετρικό Α↔Δ/ΝΑ↔ΝΔ/ΒΑ↔ΒΔ· editable). `none` ⇒ 1.0 παντού (zero-regression).
 * SSoT — ο engine διαβάζει ΜΟΝΟ από εδώ.
 */
export const HORIZON_SHADING_FACTOR: Readonly<
  Record<HorizonShadingLevel, Record<SolarOrientation, number>>
> = {
  none: { N: 1.0, NE: 1.0, E: 1.0, SE: 1.0, S: 1.0, SW: 1.0, W: 1.0, NW: 1.0 },
  low: { N: 1.0, NE: 0.99, E: 0.98, SE: 0.97, S: 0.96, SW: 0.97, W: 0.98, NW: 0.99 },
  medium: { N: 0.98, NE: 0.96, E: 0.93, SE: 0.89, S: 0.86, SW: 0.89, W: 0.93, NW: 0.96 },
  high: { N: 0.95, NE: 0.9, E: 0.84, SE: 0.76, S: 0.7, SW: 0.76, W: 0.84, NW: 0.9 },
};

/** Σειρά εμφάνισης επιπέδων ορίζοντα (για μελλοντικό dropdown «Ορίζοντας»). */
export const HORIZON_SHADING_LEVELS: readonly HorizonShadingLevel[] = [
  'none',
  'low',
  'medium',
  'high',
] as const;

/** Default επίπεδο ορίζοντα χώρου — `none` (F_hor 1.0, zero-regression). */
export const DEFAULT_HORIZON_SHADING_LEVEL: HorizonShadingLevel = 'none';

/**
 * Επίπεδο σκίασης υαλοπίνακα από **κατακόρυφα πλευρικά πτερύγια** (fins / παραστάδες /
 * πλευρικές παρειές) — ο discriminator του συντελεστή `F_fin` της EN ISO 13790 §11.4.4
 * / ΤΟΤΕΕ 20701-1. Τα πλευρικά πτερύγια κόβουν τον **πλάγιο** (πρωινό/απογευματινό)
 * χαμηλό ήλιο → **Ανατολή/Δύση επηρεάζονται περισσότερο**, ο Νότος μέτρια (ο μεσημβρινός
 * ήλιος είναι μπροστά), ο Βορράς ελάχιστα. Ξεχωριστός orientation-aware όρος του triad.
 * Default χώρου `none` (1.0 ⇒ zero-regression). Mirror του `SolarShadingLevel`.
 */
export type FinShadingLevel = 'none' | 'light' | 'moderate' | 'heavy';

/**
 * Συντελεστής σκίασης πλευρικών πτερυγίων `F_fin` ∈ (0,1] ανά **επίπεδο** και
 * **προσανατολισμό** — EN ISO 13790 §11.4.4 / ΤΟΤΕΕ 20701-1 αντιπροσωπευτικές
 * documented defaults (φθίνον με την ένταση· **Ανατολή/Δύση μέγιστη μείωση** πλάγιου
 * ήλιου, Νότος μέτρια, Βορράς ελάχιστη· συμμετρικό Α↔Δ· editable). `none` ⇒ 1.0
 * (zero-regression). SSoT — ο engine διαβάζει ΜΟΝΟ από εδώ.
 */
export const FIN_SHADING_FACTOR: Readonly<
  Record<FinShadingLevel, Record<SolarOrientation, number>>
> = {
  none: { N: 1.0, NE: 1.0, E: 1.0, SE: 1.0, S: 1.0, SW: 1.0, W: 1.0, NW: 1.0 },
  light: { N: 0.99, NE: 0.95, E: 0.92, SE: 0.94, S: 0.96, SW: 0.94, W: 0.92, NW: 0.95 },
  moderate: { N: 0.97, NE: 0.86, E: 0.78, SE: 0.84, S: 0.88, SW: 0.84, W: 0.78, NW: 0.86 },
  heavy: { N: 0.93, NE: 0.74, E: 0.62, SE: 0.72, S: 0.78, SW: 0.72, W: 0.62, NW: 0.74 },
};

/** Σειρά εμφάνισης επιπέδων πτερυγίων (για μελλοντικό dropdown «Πτερύγια»). */
export const FIN_SHADING_LEVELS: readonly FinShadingLevel[] = [
  'none',
  'light',
  'moderate',
  'heavy',
] as const;

/** Default επίπεδο πτερυγίων χώρου — `none` (F_fin 1.0, zero-regression). */
export const DEFAULT_FIN_SHADING_LEVEL: FinShadingLevel = 'none';

/**
 * Συντελεστής σκίασης ορίζοντα `F_hor` του επιπέδου. Με `orientation` → η τιμή ανά
 * προσανατολισμό· χωρίς → **orientation-agnostic μέσος** των 8 (όταν λείπει `azimuthDeg`
 * του υαλοπίνακα ⇒ zero-regression L7.1). Pure, exhaustive Record.
 */
export function getHorizonShadingFactor(level: HorizonShadingLevel): number;
export function getHorizonShadingFactor(
  level: HorizonShadingLevel,
  orientation: SolarOrientation,
): number;
export function getHorizonShadingFactor(
  level: HorizonShadingLevel,
  orientation?: SolarOrientation,
): number {
  const byOrientation = HORIZON_SHADING_FACTOR[level];
  return orientation === undefined ? orientationAgnosticMean(byOrientation) : byOrientation[orientation];
}

/**
 * Συντελεστής σκίασης πλευρικών πτερυγίων `F_fin` του επιπέδου. Με `orientation` → η
 * τιμή ανά προσανατολισμό· χωρίς → **orientation-agnostic μέσος** των 8 (zero-regression
 * όταν λείπει `azimuthDeg`). Pure, exhaustive Record.
 */
export function getFinShadingFactor(level: FinShadingLevel): number;
export function getFinShadingFactor(level: FinShadingLevel, orientation: SolarOrientation): number;
export function getFinShadingFactor(level: FinShadingLevel, orientation?: SolarOrientation): number {
  const byOrientation = FIN_SHADING_FACTOR[level];
  return orientation === undefined ? orientationAgnosticMean(byOrientation) : byOrientation[orientation];
}

// ─── L7.3 Slice D — Geometry-derived πλευρικό πτερύγιο (F_fin) ──────────────────

/**
 * Συντελεστής σκίασης **πλευρικού πτερυγίου** `F_fin` ∈ (0,1] ανά **προσανατολισμό**
 * και **γωνία πτερυγίου** `β_fin = atan(d_fin/w_ref)` — geometry-derived **κατοπτρικό
 * του `OVERHANG_SHADING_FACTOR`** (Slice B) στον **οριζόντιο-πλευρικό** άξονα (EN ISO
 * 13790 §11.4.4 `F_sh,gl = F_hor·F_ov·F_fin` / ΤΟΤΕΕ 20701-1 πίν. πλευρικών πτερυγίων /
 * Revit Energy «Shading»), αντιπροσωπευτικές documented defaults (editable). Φυσική
 * (**ΑΝΤΙΘΕΤΟ** του προβόλου):
 *   - **Α/Δ = μέγιστη μείωση** — το πτερύγιο κόβει τον **πλάγιο** πρωινό/απογευματινό
 *     χαμηλό ήλιο που έρχεται από το πλάι.
 *   - **Β ≈ 1.0** — μόνο διάχυτη ακτινοβολία, ελάχιστα κομμένη.
 *   - **Ν μέτρια** — ο μεσημβρινός ήλιος είναι **μπροστά** (όχι πλάγια)· ΝΑ/ΝΔ & ΒΑ/ΒΔ
 *     ενδιάμεσα. Συμμετρικό Α↔Δ.
 * **Βαθμονόμηση** ώστε να συμφωνεί σε τάξη μεγέθους με τον level-based `FIN_SHADING_FACTOR`
 * (Slice C): βαθύ πτερύγιο (`β≈22°`, π.χ. d_fin=0.6/w=1.5) ⇒ ≈ `moderate`· ρηχό (`β<10°`)
 * ⇒ ≈ `light`· πολύ βαθύ (`β≈45°`) ⇒ ≈ `heavy` — **ίδια σειρά μείωσης** Α/Δ > ΝΑ/ΝΔ >
 * ΒΑ/ΒΔ > Ν > Β με το Slice C. `β=0` ⇒ `1.0` παντού ⇒ zero-regression. Γραμμική
 * interpolation (`getFinGeometryShadingFactor`). SSoT — ο resolver διαβάζει ΜΟΝΟ από εδώ.
 */
export const FIN_GEOMETRY_SHADING_FACTOR: Readonly<
  Record<SolarOrientation, readonly OverhangShadingBand[]>
> = {
  E:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.72 }, { angle: 45, factor: 0.60 }, { angle: 60, factor: 0.50 }],
  W:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.72 }, { angle: 45, factor: 0.60 }, { angle: 60, factor: 0.50 }],
  SE: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.76 }, { angle: 45, factor: 0.65 }, { angle: 60, factor: 0.56 }],
  SW: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.76 }, { angle: 45, factor: 0.65 }, { angle: 60, factor: 0.56 }],
  NE: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.80 }, { angle: 45, factor: 0.70 }, { angle: 60, factor: 0.62 }],
  NW: [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.80 }, { angle: 45, factor: 0.70 }, { angle: 60, factor: 0.62 }],
  S:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.86 }, { angle: 45, factor: 0.78 }, { angle: 60, factor: 0.72 }],
  N:  [{ angle: 0, factor: 1.0 }, { angle: 30, factor: 0.97 }, { angle: 45, factor: 0.94 }, { angle: 60, factor: 0.91 }],
};

/**
 * Συντελεστής σκίασης πλευρικού πτερυγίου `F_fin` για γωνία `β_fin` (deg) και
 * προσανατολισμό — **γραμμική interpolation** στις γωνίες του `FIN_GEOMETRY_SHADING_FACTOR`
 * (REUSE `interpolateOrientationBands`, ΑΥΤΟΛΕΞΕΙ ίδιο pattern με `getOverhangShadingFactor`).
 * `β ≤ 0` ⇒ `1.0` (κανένα πτερύγιο, zero-regression)· `β` πέρα από την τελευταία γωνία ⇒
 * clamp στον τελευταίο συντελεστή. Αποτέλεσμα `∈ (0,1]`. Pure, idempotent.
 */
export function getFinGeometryShadingFactor(angleDeg: number, orientation: SolarOrientation): number {
  return interpolateOrientationBands(FIN_GEOMETRY_SHADING_FACTOR[orientation], angleDeg);
}
