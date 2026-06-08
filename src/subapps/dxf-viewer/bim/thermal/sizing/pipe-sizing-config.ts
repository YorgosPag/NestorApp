/**
 * ADR-422 L3 — Pipe-sizing config SSoT (D5 «velocity + friction»).
 *
 * Σταθερές για τη διαστασιολόγηση σωληνώσεων θέρμανσης (Revit «Pipe Sizing» /
 * 4M-FineHEAT). ΚΑΜΙΑ αριθμητική εδώ — μόνο config:
 *
 *   - Ιδιότητες νερού @~70°C (μέση θερμοκρασία hydronic βρόχου): ειδική θερμότητα,
 *     πυκνότητα, δυναμικό ιξώδες. Editable SSoT — μελλοντικά temperature-aware.
 *   - `HEATING_DN_LADDER` — κλίμακα ονομαστικών διαμέτρων (DN15…DN50) με
 *     **εξωτερική** (γράφεται στο `mep-segment.params.diameter`) και **εσωτερική**
 *     (ταχύτητα/τριβή) διάμετρο σε mm. Αντιπροσωπευτικές τιμές χαλκού/χάλυβα.
 *   - `MAX_VELOCITY_M_S` / `MAX_FRICTION_PA_M` — τα δύο όρια του D5: ο πρώτος
 *     βαθμός της κλίμακας που τα ικανοποιεί ΚΑΙ ΤΑ ΔΥΟ κερδίζει.
 *
 * @see ./pipe-sizing (computePipeMassFlow / pipeVelocity / pipeFriction — pure math)
 * @see ./velocity-friction-standard (η pluggable επιλογή DN πάνω σε αυτή την κλίμακα)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §2 D5 / §3 L3
 */

/** J/(kg·K) — ειδική θερμότητα νερού @~70°C (hydronic μέση). Editable SSoT. */
export const WATER_SPECIFIC_HEAT_J_KGK = 4187;

/** kg/m³ — πυκνότητα νερού @~70°C. Editable SSoT. */
export const WATER_DENSITY_KG_M3 = 977.8;

/** Pa·s — δυναμικό ιξώδες νερού @~70°C (για τον αριθμό Reynolds). Editable SSoT. */
export const WATER_DYNAMIC_VISCOSITY_PA_S = 4.04e-4;

/** Απόλυτη τραχύτητα τοιχώματος (mm) — λεία σωλήνωση (χαλκός/PEX). Future per-material. */
export const PIPE_ROUGHNESS_MM = 0.0015;

/** Ένας βαθμός της κλίμακας DN: ονομαστική + εξωτ./εσωτ. διάμετρος (mm). */
export interface DnLadderStep {
  /** Ονομαστική διάμετρος (DN, mm) — η ετικέτα. */
  readonly dnMm: number;
  /** mm — εξωτερική διάμετρος (γράφεται στο `mep-segment.params.diameter`). */
  readonly outerMm: number;
  /** mm — εσωτερική διάμετρος (ταχύτητα/τριβή ροής). */
  readonly innerMm: number;
}

/**
 * Κλίμακα DN θέρμανσης (αύξουσα). Αντιπροσωπευτικές εξωτ./εσωτ. διάμετροι χαλκού/
 * χάλυβα — config SSoT, swappable ανά υλικό σε μελλοντικό standard.
 */
export const HEATING_DN_LADDER: readonly DnLadderStep[] = [
  { dnMm: 15, outerMm: 18, innerMm: 16.0 },
  { dnMm: 20, outerMm: 22, innerMm: 20.0 },
  { dnMm: 25, outerMm: 28, innerMm: 25.6 },
  { dnMm: 32, outerMm: 35, innerMm: 32.0 },
  { dnMm: 40, outerMm: 42, innerMm: 39.0 },
  { dnMm: 50, outerMm: 54, innerMm: 51.0 },
];

/** m/s — μέγιστη επιτρεπτή ταχύτητα ροής (residential hydronic, αθόρυβο). */
export const MAX_VELOCITY_M_S = 1.0;

/** Pa/m — μέγιστη επιτρεπτή ειδική απώλεια τριβής (D5 friction limit). */
export const MAX_FRICTION_PA_M = 150;
