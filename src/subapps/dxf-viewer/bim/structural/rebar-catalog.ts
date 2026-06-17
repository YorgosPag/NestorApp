/**
 * Reinforcement steel (rebar) catalog SSoT (ADR-456 — Στατικά, Slice 1B).
 *
 * B500C ductility-class-C reinforcing steel (EN 10080 / ΕΛΟΤ 1421-3) — the
 * standard Greek rebar grade under both Eurocode 2 and legacy ΕΚΩΣ workflows.
 * Mass-per-metre is DERIVED from the nominal diameter (single source: the
 * area × density formula), never a hardcoded lookup table.
 *
 * Units: διάμετροι σε mm, μάζα σε kg/m, αντοχές σε MPa.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

/** Πυκνότητα χάλυβα οπλισμού (kg/m³). EN 1991-1-1 — ίδια με δομικό χάλυβα. */
export const REBAR_STEEL_DENSITY_KGM3 = 7850;

/**
 * Χρώμα-ταυτότητα οπλισμού (κόκκινο) — ΕΝΑ SSoT για ΟΛΑ τα rendering contexts
 * (2Δ canvas renderers, PDF detail-sheet builders, 3Δ THREE.js materials).
 * Πριν το ADR-471 Slice 6 το ίδιο literal ήταν σκορπισμένο σε 10 αρχεία.
 * `REBAR_COLOR_HEX` = CSS/PDF string· `REBAR_COLOR_INT` = το ίδιο ως 0xRRGGBB
 * integer για `THREE.MeshBasicMaterial({ color })`.
 */
export const REBAR_COLOR_HEX = '#c0392b';
export const REBAR_COLOR_INT = 0xc0392b;

/** Ποιότητα χάλυβα οπλισμού (ductility class C — υποχρεωτική σε σεισμικές ζώνες). */
export const REBAR_GRADE = 'B500C';

/** Χαρακτηριστικό όριο διαρροής fyk (MPa). */
export const REBAR_FYK_MPA = 500;

/** Partial safety factor χάλυβα γs (EN 1992-1-1 §2.4.2.4, persistent/transient). */
export const GAMMA_S = 1.15;

/** Εμπορικές διάμετροι ράβδων οπλισμού (mm) — ΕΛΟΤ / EN 10080. */
export const REBAR_DIAMETERS_MM = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32] as const;

export type RebarDiameterMm = (typeof REBAR_DIAMETERS_MM)[number];

/** Εμβαδό διατομής μίας ράβδου Ø (mm²) = π/4·d². */
export function barAreaMm2(diameterMm: number): number {
  return (Math.PI / 4) * diameterMm * diameterMm;
}

/**
 * Μάζα ανά μέτρο μήκους ράβδου Ø (kg/m) = εμβαδό(m²) × ρ. Για Ø16 → ~1.578 kg/m
 * (ταιριάζει με τους εμπορικούς πίνακες οπλισμού).
 */
export function barMassPerMeterKg(diameterMm: number): number {
  const areaM2 = barAreaMm2(diameterMm) * 1e-6;
  return areaM2 * REBAR_STEEL_DENSITY_KGM3;
}

/** Τιμή σχεδιασμού ορίου διαρροής fyd = fyk/γs (MPa). */
export function rebarFydMpa(gammaS: number = GAMMA_S): number {
  return REBAR_FYK_MPA / gammaS;
}

/**
 * Επόμενη εμπορική διάμετρος ≥ `minMm` (π.χ. αναβάθμιση όταν ο οπλισμός δεν
 * φτάνει το ρ_min). Επιστρέφει τη μέγιστη διαθέσιμη αν καμία δεν είναι αρκετά
 * μεγάλη.
 */
export function nextRebarDiameterMm(minMm: number): RebarDiameterMm {
  for (const d of REBAR_DIAMETERS_MM) {
    if (d >= minMm) return d;
  }
  return REBAR_DIAMETERS_MM[REBAR_DIAMETERS_MM.length - 1];
}

// ─── Μήκη ανάπτυξης (lap / anchorage) — κοινή λογική modifiers (ADR-459 Φ4c) ─────

/**
 * Τροποποιητές μήκους ανάπτυξης ράβδου (EC2 §8.4/§8.7). Κρατιούνται εδώ ώστε η
 * λογική των συντελεστών (συνθήκη συνάφειας, εφελκυσμός/θλίψη) να είναι **ΕΝΑ
 * SSoT** — οι code providers δίνουν ΜΟΝΟ τον βασικό συντελεστή `factor·Ø`.
 */
export interface BarDevelopmentModifiers {
  /** EC2 §8.4.2 συνθήκη συνάφειας. `poor` → δυσμενέστερη ανάπτυξη (default `good`). */
  readonly bondCondition?: 'good' | 'poor';
  /** Εφελκυόμενη ράβδος; default `true` (δυσμενέστερο). Θλίψη → μικρότερη ανάπτυξη. */
  readonly inTension?: boolean;
}

/** EC2 §8.4.2 — συντελεστής κακής συνάφειας (η₁ = 0.7 → 1/η₁ ≈ 1.4). */
const POOR_BOND_MULTIPLIER = 1.4;
/** Απλοποιημένη μείωση για θλιβόμενη ράβδο (ευμενέστερες α-συνθήκες ανάπτυξης). */
const COMPRESSION_MULTIPLIER = 0.7;

/**
 * Μήκος ανάπτυξης ράβδου (mm) = `baseFactor·Ø` × modifiers. Απλοποιημένο μοντέλο
 * `factor·Ø` (το πλήρες `lb,rqd = (Ø/4)(σsd/fbd)` με fbd από fctd, EC2 §8.4.2,
 * είναι DEFER). Μονότονο στο Ø — εγγυάται ordering στα tests.
 */
export function developmentLengthMm(
  baseFactor: number,
  diameterMm: number,
  mods?: BarDevelopmentModifiers,
): number {
  const bond = mods?.bondCondition === 'poor' ? POOR_BOND_MULTIPLIER : 1;
  const tension = mods?.inTension === false ? COMPRESSION_MULTIPLIER : 1;
  return baseFactor * diameterMm * bond * tension;
}
