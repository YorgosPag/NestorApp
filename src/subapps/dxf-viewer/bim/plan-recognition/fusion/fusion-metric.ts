/**
 * ADR-929 §6.22 — **η μετρική της σύντηξης** (SSoT): πόσα mm είναι ένα ευθυγραμμισμένο pixel, **ανά διεύθυνση**.
 *
 * 🔴 **Γιατί υπάρχει.** Η βαθμονόμηση λύνει χωριστή κλίμακα X/Y (`calibration-solve.ts`, `per-axis`: το τέντωμα 1–2 % του
 * σαρωτή) και η εικόνα τοποθετείται με αυτήν. Η σύντηξη τη συνέπτυσσε σε **έναν** αριθμό (γεωμετρικό μέσο), και ο λύτης
 * έσπρωχνε τις παρειές προς τιμές λάθος κατά ±ανισοτροπία/2 — **ξαναχαλούσε** ό,τι η βαθμονόμηση είχε διορθώσει
 * (μετρημένο στο ΤΕΣΤ2: 2,05000 → 2,05048 · 4,12000 → 4,11903 μετά το «Κράτησε»).
 *
 * 📐 **Το μοντέλο (GIS/φωτογραμμετρία: World File, ArcGIS/QGIS affine).** Η τοπική απεικόνιση ευθυγραμμισμένο px → mm είναι
 * ένας **γραμμικός τελεστής** `A = S · J`: `J` η Ιακωβιανή ευθυγραμμισμένα → αρχικά px (ομογραφία, στο κέντρο του σχεδίου),
 * `S` η κλίμακα της πηγής στα αρχικά px (`diag(mX, mY)` για βαθμονόμηση, `s·I` για γραμμένη κλίμακα). Ό,τι μετρήθηκε
 * **απευθείας** στο ευθυγραμμισμένο πλαίσιο (συναίνεση διαστάσεων, εμβαδά) είναι `k·I`.
 * - **Απόσταση δύο παράλληλων ευθειών** `n·p = c₁, c₂` (αυτό μετρά κάθε διάσταση): στον κόσμο οι ευθείες γίνονται
 *   `(A⁻ᵀn)·w = c`, άρα απόσταση `|c₂ − c₁| / |A⁻ᵀn|` ⇒ **px ανά mm κατά την κάθετο = `|A⁻ᵀn|`** (δυϊκή νόρμα). Ακριβές
 *   και για **λοξές** οικογένειες· το «`|A·n|`» θα ήταν λάθος εκεί, γιατί η κάθετος στην εικόνα δεν μένει κάθετος στον κόσμο.
 * - **Εμβαδά και σύγκριση πηγών**: `|det A|` ⇒ `mmPerAlignedPx = √|det A|` (ο γεωμετρικός μέσος) είναι **ακριβής** για
 *   εμβαδά και μένει η βαθμωτή σύνοψη για τον έλεγχο συνέπειας (Δ4) και την κάρτα κλίμακας.
 * - **Ισοτροπική πηγή + ομοιότητα** ⇒ `|A⁻ᵀn| = 1 / mmPerAlignedPx` για κάθε `n`: η παλιά συμπεριφορά είναι ειδική
 *   περίπτωση, όχι δεύτερος δρόμος.
 *
 * ΚΑΘΑΡΟ (pure) — μηδέν React/store/DOM. Ντετερμινιστικό.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/fusion-metric
 * @see ./scale-evidence.ts — οι πηγές που χτίζουν μετρική · ./adjustment-network.ts — ο λύτης που τη χρησιμοποιεί
 */

import { composeAffine, invertAffine, type Affine2x3 } from '@/lib/geometry/affine-2x3';
import type { PlanePoint } from '@/lib/geometry/homography';
import { familyNormal, type FusionFrame } from './fusion-frame';

/** Η μετρική: ο τελεστής `A` (ευθυγραμμισμένα px → mm, `e = f = 0`) και η βαθμωτή σύνοψή του `√|det A|`. */
export interface FusionMetric {
  readonly linear: Affine2x3;
  readonly mmPerAlignedPx: number;
}

/** Ευθυγραμμισμένα px ανά mm **κατά την κάθετο** μιας οικογένειας ευθειών. */
export type FamilyPxPerMm = (familyId: number) => number;

const linearDiag = (x: number, y: number): Affine2x3 => ({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 });

function metricOf(linear: Affine2x3): FusionMetric {
  return { linear, mmPerAlignedPx: Math.sqrt(Math.abs(linear.a * linear.d - linear.b * linear.c)) };
}

/** Πηγή μετρημένη **απευθείας** στο ευθυγραμμισμένο πλαίσιο (συναίνεση διαστάσεων, εμβαδά): `k·I`. */
export const isotropicMetric = (mmPerAlignedPx: number): FusionMetric => metricOf(linearDiag(mmPerAlignedPx, mmPerAlignedPx));

/**
 * Πηγή μετρημένη στα **αρχικά** px της εικόνας (βαθμονόμηση: `mmX ≠ mmY` · γραμμένη κλίμακα: `mmX = mmY`): `diag · J`.
 * Οι άξονες X/Y είναι **της εικόνας** (σημασιολογία του `RasterPixelScale`), άρα ο πίνακας εφαρμόζεται **μετά** την `J`.
 */
export function metricFromOriginal(mmPerOriginalPxX: number, mmPerOriginalPxY: number, frame: Pick<FusionFrame, 'alignedToOriginalJacobian'>): FusionMetric {
  return metricOf(composeAffine(linearDiag(mmPerOriginalPxX, mmPerOriginalPxY), frame.alignedToOriginalJacobian));
}

/** Η ίδια μορφή, άλλη συνολική κλίμακα: η ελεύθερη `K` του λύτη αλλάζει **μόνο** το μέγεθος, όχι το σχήμα (§6.22). */
export function scaledMetric(metric: FusionMetric, mmPerAlignedPx: number): FusionMetric {
  const k = mmPerAlignedPx / metric.mmPerAlignedPx;
  const m = metric.linear;
  return metricOf({ a: m.a * k, b: m.b * k, c: m.c * k, d: m.d * k, e: 0, f: 0 });
}

/**
 * Px ανά mm κατά την κάθετο `n` (μοναδιαίο): `|A⁻ᵀn|`. Στη σημασιολογία `ctx.transform` ο `A⁻¹` είναι `[[a c][b d]]`, άρα
 * ο ανάστροφος δίνει `(a·nx + b·ny, c·nx + d·ny)`. Εκφυλισμένος τελεστής ⇒ η βαθμωτή σύνοψη (καμία σιωπηλή `NaN`).
 */
export function pxPerMmAcross(metric: FusionMetric, n: PlanePoint): number {
  const inv = invertAffine(metric.linear);
  if (inv === null) return 1 / metric.mmPerAlignedPx;
  return Math.hypot(inv.a * n.x + inv.b * n.y, inv.c * n.x + inv.d * n.y);
}

/** Η **μία** ερώτηση «px ανά mm γι' αυτή την οικογένεια» — ο λύτης, η δέση, τα ευρήματα και οι ερωτήσεις ρωτούν μόνο εδώ. */
export function familyPxPerMm(metric: FusionMetric, frame: Pick<FusionFrame, 'families'>): FamilyPxPerMm {
  const byFamily = new Map(frame.families.map((f) => [f.id, pxPerMmAcross(metric, familyNormal(f))]));
  return (familyId) => byFamily.get(familyId) ?? 1 / metric.mmPerAlignedPx;
}
