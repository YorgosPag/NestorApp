/**
 * ADR-422 L1 — Χρωματική κλίμακα αναλυτικού φορτίου (heat-map) — PURE config.
 *
 * Δίνει translucent fill colour ανά **ειδικό φορτίο** (W/m²) για το analytical
 * overlay, όπως το Revit "Heating Loads" χρωματικό φίλτρο: ψυχρό (μπλε) → θερμό
 * (κόκκινο). Ο χρωματισμός είναι **σχετικός** στο εύρος [min,max] των χώρων του
 * ορόφου — έτσι ο μελετητής βλέπει αμέσως ποιοι χώροι «βαραίνουν» περισσότερο.
 *
 * Μηδέν React/state — καθαρή αριθμητική + string. Degenerate εύρος (ένας χώρος ή
 * min==max) → ενδιάμεσο χρώμα (t=0.5) ώστε να μην «κολλάει» στο μπλε.
 *
 * @see ./derive-space-heat-loads (παράγει το {minWperM2,maxWperM2})
 * @see ./HeatLoadOverlay (consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

import { clamp01 as clampUnitInterval } from '../../../rendering/entities/shared/geometry-utils';

/** Ψυχρό άκρο (χαμηλό φορτίο) — μπλε. */
const COLD_RGB: readonly [number, number, number] = [37, 99, 235]; // #2563eb
/** Θερμό άκρο (υψηλό φορτίο) — κόκκινο. */
const HOT_RGB: readonly [number, number, number] = [220, 38, 38]; // #dc2626

/** Αδιαφάνεια fill — αρκετή για να φανεί το χρώμα, διαφανής για να φαίνεται το σχέδιο. */
export const HEAT_LOAD_FILL_ALPHA = 0.3;

/** [0,1] clamp (SSoT `clamp01`) + NaN guard → μεσαίο t όταν degenerate (μηδέν crash). */
function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0.5;
  return clampUnitInterval(t);
}

/** Κανονικοποιημένη θέση `t∈[0,1]` του `value` στο εύρος [min,max] (degenerate → 0.5). */
export function normalizeHeatLoad(value: number, min: number, max: number): number {
  if (!(max > min)) return 0.5;
  return clamp01((value - min) / (max - min));
}

/**
 * Translucent fill colour (`rgba(...)`) για ειδικό φορτίο `wPerM2`, σχετικά στο
 * εύρος [min,max]. Γραμμική παρεμβολή μπλε→κόκκινο.
 */
export function heatLoadFillColor(
  wPerM2: number,
  min: number,
  max: number,
  alpha: number = HEAT_LOAD_FILL_ALPHA,
): string {
  const t = normalizeHeatLoad(wPerM2, min, max);
  const r = Math.round(COLD_RGB[0] + (HOT_RGB[0] - COLD_RGB[0]) * t);
  const g = Math.round(COLD_RGB[1] + (HOT_RGB[1] - COLD_RGB[1]) * t);
  const b = Math.round(COLD_RGB[2] + (HOT_RGB[2] - COLD_RGB[2]) * t);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
