/**
 * ADR-650 M7 — οι ΕΛΛΗΝΙΚΕΣ ΝΟΜΙΚΕΣ ΑΝΟΧΕΣ, κωδικοποιημένες (§10).
 *
 * Τίποτα εδώ δεν είναι εφεύρεση: κάθε αριθμός προέρχεται από το §10 του ADR-650, το οποίο τον
 * αντλεί από τον **Ν.4495/2017 Αρ.39§2 & Αρ.42§10** (όπως τροπ. Ν.4759/2020) και την **Εγκύκλιο
 * ΥΠΕΝ/ΔΑΟΚΑ/110061/3317/2020**. Οι ανοχές είναι **scale-independent** — δεν εξαρτώνται από την
 * κλίμακα του σχεδίου, μόνο από το μέγεθος του μεγέθους που ελέγχεται.
 *
 * Ο έλεγχος συγκρίνει το **μετρημένο** (αυτό που βγάζει η αποτύπωσή μας) με το **δηλωμένο**
 * (αυτό που γράφει ο τίτλος / συμβόλαιο). Χωρίς δηλωμένη τιμή ΔΕΝ υπάρχει έλεγχος — επιστρέφουμε
 * `not-declared`, ποτέ ψεύτικο «πέρασε» (AI-accelerant / human-certifier, §9).
 *
 * ΔΕΝ κωδικοποιείται εδώ η ανοχή **κτιρίου** (2% / ≤20cm): το τοπογραφικό subsystem δεν γνωρίζει
 * περίγραμμα κτιρίου — θα μπει όταν υπάρξει καταναλωτής, όχι προληπτικά (νεκρός κώδικας).
 */

import { lengthMmToM } from '../../../utils/scene-units';

/** Εντός ή εκτός σχεδίου — καθορίζει ΜΟΝΟ την ανοχή εμβαδού (§10). */
export type PlotZone = 'in-plan' | 'out-of-plan';

/** Εμβαδόν: **±5% εντός σχεδίου, ±10% εκτός** (Ν.4495/2017 Αρ.42§10). */
export const AREA_TOLERANCE_PCT: Readonly<Record<PlotZone, number>> = {
  'in-plan': 5,
  'out-of-plan': 10,
};

/**
 * Περίμετρος οικοπέδου: **2% ΚΑΙ όχι μεγαλύτερη των 40cm** (Ν.4495/2017 Αρ.39§2). Δύο όροι
 * ταυτόχρονα ⇒ ισχύει ο **αυστηρότερος**: `min(2%·L, 40cm)`. Το cap ζει σε canonical mm (ADR-462)
 * και μετατρέπεται σε μέτρα από το units SSoT — ποτέ inline `/1000`.
 */
export const PERIMETER_TOLERANCE_PCT = 2;
export const PERIMETER_TOLERANCE_CAP_MM = 400;

/** `pass` = εντός ανοχής· `fail` = εκτός· `not-declared` = δεν δόθηκε τιμή τίτλου, δεν ελέγχθηκε. */
export type ToleranceStatus = 'pass' | 'fail' | 'not-declared';

/** Ο έλεγχος ενός μεγέθους. Οι τιμές είναι σε **μονάδες παρουσίασης** (m² για εμβαδόν, m για μήκη). */
export interface ToleranceCheck {
  readonly id: 'area' | 'perimeter';
  readonly status: ToleranceStatus;
  readonly measured: number;
  /** Η τιμή του τίτλου/συμβολαίου. `null` ⇒ ο χρήστης δεν τη δήλωσε. */
  readonly declared: number | null;
  /** `|measured − declared|`. `null` όταν δεν υπάρχει δηλωμένη τιμή. */
  readonly deviation: number | null;
  /** Το μέγιστο που επιτρέπει ο νόμος. `null` όταν δεν υπάρχει δηλωμένη τιμή. */
  readonly allowed: number | null;
}

/** Κοινή κρίση: απόκλιση vs επιτρεπτό. Ένα σημείο απόφασης για όλους τους ελέγχους. */
function judge(
  id: ToleranceCheck['id'],
  measured: number,
  declared: number | null,
  allowedFor: (declaredValue: number) => number,
): ToleranceCheck {
  if (declared === null || !Number.isFinite(declared) || declared <= 0) {
    return { id, status: 'not-declared', measured, declared: null, deviation: null, allowed: null };
  }
  const deviation = Math.abs(measured - declared);
  const allowed = allowedFor(declared);
  return {
    id,
    status: deviation <= allowed ? 'pass' : 'fail',
    measured,
    declared,
    deviation,
    allowed,
  };
}

/** Εμβαδόν οικοπέδου (m²) — ποσοστιαία ανοχή που εξαρτάται από εντός/εκτός σχεδίου. */
export function checkAreaTolerance(
  measuredM2: number,
  declaredM2: number | null,
  zone: PlotZone,
): ToleranceCheck {
  const pct = AREA_TOLERANCE_PCT[zone];
  return judge('area', measuredM2, declaredM2, (declared) => (declared * pct) / 100);
}

/** Περίμετρος οικοπέδου (m) — ο **αυστηρότερος** από 2% και 40cm. */
export function checkPerimeterTolerance(
  measuredM: number,
  declaredM: number | null,
): ToleranceCheck {
  const capM = lengthMmToM(PERIMETER_TOLERANCE_CAP_MM);
  return judge('perimeter', measuredM, declaredM, (declared) =>
    Math.min((declared * PERIMETER_TOLERANCE_PCT) / 100, capM),
  );
}

/** Τι δήλωσε ο τίτλος — ό,τι λείπει μένει `null` και δεν ελέγχεται. */
export interface DeclaredPlot {
  readonly areaM2: number | null;
  readonly perimeterM: number | null;
  readonly zone: PlotZone;
}

/** Το μετρημένο οικόπεδο, όπως το βγάζει η αποτύπωση. */
export interface MeasuredPlot {
  readonly areaM2: number;
  readonly perimeterM: number;
}

/** Και οι δύο έλεγχοι, με τη σειρά που τους διαβάζει ο μηχανικός. */
export function runToleranceChecks(
  measured: MeasuredPlot,
  declared: DeclaredPlot,
): readonly ToleranceCheck[] {
  return [
    checkAreaTolerance(measured.areaM2, declared.areaM2, declared.zone),
    checkPerimeterTolerance(measured.perimeterM, declared.perimeterM),
  ];
}

/** Περνάει ο φάκελος; Ένα `fail` αρκεί για να μην περάσει· τα `not-declared` δεν κρίνουν. */
export function toleranceVerdict(checks: readonly ToleranceCheck[]): ToleranceStatus {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'pass')) return 'pass';
  return 'not-declared';
}
