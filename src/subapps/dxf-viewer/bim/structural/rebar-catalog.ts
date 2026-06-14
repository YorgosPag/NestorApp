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
