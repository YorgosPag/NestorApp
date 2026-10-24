/**
 * ADR-583 Φ2 — Scale-bar length quantizer (1 · 2 · 5 × 10ⁿ) — ΕΠΑΝΕΞΑΓΩΓΗ.
 *
 * ΕΝΑ σπίτι: το σώμα ζει στο `@/lib/geometry/scale-bar-length-snap` (ADR-920 Β4.8,
 * 2026-10-24) — ο χάρτης εδάφους της αγγελίας ρωτά την ίδια ερώτηση και δεν επιτρέπεται
 * να εισάγει από το subapp (CHECK 3.62). Η εισαγωγή πηγαίνει προς τα μέσα (subapp → lib).
 * Ίδιο σώμα, ίδια σημασιολογία· 🔴 ΜΗΝ γράψεις εδώ δεύτερο σώμα — το κλειδώνει το
 * `__tests__/scale-bar-length-snap-reexport.test.ts` (ταυτότητα, όχι ισοδυναμία).
 *
 * @see bim/scale-bar/build-scale-bar-entity.ts — the subapp caller
 * @see utils/scale-bar-divisions.ts — division/subdivision boundary math
 */

export { snapScaleBarLength } from '@/lib/geometry/scale-bar-length-snap';
