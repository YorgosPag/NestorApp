/**
 * ADR-422 L7.5 — Geometry-derived frame factor `F_F` (PURE SSoT).
 *
 * Υπολογίζει τον **συντελεστή πλαισίου** `F_F` ενός κουφώματος **γεωμετρικά** =
 * επιφάνεια υαλοπίνακα / επιφάνεια ανοίγματος (EN ISO 13790 §11.3.2 / ΤΟΤΕΕ
 * 20701-1 / Revit Energy «Frame/Glass ratio» / 4M-FineHEAT). Καθαρή γεωμετρία —
 * μηδέν scene/store/React (mirror του `solar-overhang-geometry.ts`):
 *
 *   F_F = A_glass / A_opening = (W − 2f)·(H − 2f) / (W·H)
 *
 * όπου `W`=πλάτος, `H`=ύψος, `f`=πλάτος κάσας (mm). Φαρδιά κάσα (μεγάλο `f`) →
 * μικρότερη επιφάνεια τζαμιού → μικρότερο `F_F` → λιγότερα ηλιακά κέρδη. `f=0` ⇒
 * `F_F=1` (όλο τζάμι). Οι μονάδες απλοποιούνται στον λόγο (unit-agnostic — αρκεί
 * `W`/`H`/`f` στην ίδια μονάδα).
 *
 * **Σκοπίμως ΜΟΝΟ γεωμετρικό:** ο συντελεστής ανά **τύπο υλικού** πλαισίου
 * (ξύλο/αλουμίνιο/PVC ΤΟΤΕΕ catalog) = documented future (απαιτεί νέο schema
 * `frameType?`). Το `frameWidth` είναι το μόνο frame signal που υπάρχει ΗΔΗ
 * αξιόπιστα στο μοντέλο.
 *
 * @see ./annual-gains-config (FRAME_FACTOR — το σταθερό fallback baseline 0.70)
 * @see ./space-boundary-resolver (per-window consumer — buildOpeningBoundary)
 * @see ./derive-annual-energy (aggregator — διαβάζει `frameFactorF ?? FRAME_FACTOR`)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7.5)
 */

/** Κάτω όριο του `F_F` (αποφυγή μηδενικού/αρνητικού — διατηρεί `∈ (0,1]`). */
const FRAME_FACTOR_FLOOR = 0.01;

/** Κάτω από αυτό το πλάτος/ύψος μια διάσταση θεωρείται degenerate (μηδενική). */
const FRAME_GEOMETRY_EPS = 1e-6;

/**
 * Γεωμετρικός συντελεστής πλαισίου `F_F = (W−2f)(H−2f)/(W·H)` ∈ (0,1]. Η κάσα
 * πλάτους `f` αφαιρείται από κάθε πλευρά (×2). Guards:
 *   - `W ≤ ε` ή `H ≤ ε` (degenerate άνοιγμα) ⇒ κάτω όριο `FRAME_FACTOR_FLOOR`,
 *   - `W ≤ 2f` ή `H ≤ 2f` (κάσα καλύπτει όλο το άνοιγμα — μηδέν/αρνητικό τζάμι) ⇒
 *     κάτω όριο (floor),
 *   - `f ≤ 0` ⇒ `F_F=1` (καμία κάσα, όλο τζάμι).
 * Αποτέλεσμα clamped `∈ [FRAME_FACTOR_FLOOR, 1]`. Pure, idempotent.
 */
export function computeFrameFactor(widthMm: number, heightMm: number, frameWidthMm: number): number {
  if (widthMm <= FRAME_GEOMETRY_EPS || heightMm <= FRAME_GEOMETRY_EPS) return FRAME_FACTOR_FLOOR;
  const f = frameWidthMm > 0 ? frameWidthMm : 0;
  const glassW = widthMm - 2 * f;
  const glassH = heightMm - 2 * f;
  if (glassW <= FRAME_GEOMETRY_EPS || glassH <= FRAME_GEOMETRY_EPS) return FRAME_FACTOR_FLOOR;
  const ratio = (glassW * glassH) / (widthMm * heightMm);
  return Math.min(1, Math.max(FRAME_FACTOR_FLOOR, ratio));
}
