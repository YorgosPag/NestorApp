/**
 * Utilization colour ramp — pure SSoT (ADR-485, T3-UI / Slice 4c).
 *
 * Διακριτή χρωματική κλίμακα επάρκειας (Robot/SAP2000 «stress map»):
 *   · πράσινο  ratio ≤ 0.85  → επαρκές
 *   · πορτοκαλί 0.85 < ratio ≤ 1.0 → οριακό
 *   · κόκκινο  ratio > 1.0  → ανεπαρκές (υπερ-εκμετάλλευση)
 *
 * Διακριτή (όχι συνεχής) σκόπιμα: ο μηχανικός θέλει σαφές pass/marginal/fail, όχι
 * gradient. Δύο εκδοχές κάθε χρώματος: translucent `fill` (γέμισμα footprint) + solid
 * `legend` (υπόμνημα). Pure — zero React/DOM.
 *
 * @see ./member-utilization.ts — η πηγή του ratio
 * @see ../../../components/dxf-layout/StructuralUtilizationOverlay.tsx — consumer
 */

/** Κατώφλι «οριακού» (κάτω από αυτό = επαρκές/πράσινο). */
export const UTILIZATION_OK_MAX = 0.85;
/** Κατώφλι «ανεπαρκούς» (πάνω από αυτό = υπερ-εκμετάλλευση/κόκκινο). */
export const UTILIZATION_WARN_MAX = 1.0;

/** Διακριτή βαθμίδα επάρκειας. */
export type UtilizationBand = 'ok' | 'warn' | 'over';

const FILL: Record<UtilizationBand, string> = {
  ok: 'rgba(34,160,75,0.34)',
  warn: 'rgba(230,150,20,0.40)',
  over: 'rgba(210,40,45,0.42)',
};

const LEGEND: Record<UtilizationBand, string> = {
  ok: 'rgb(34,160,75)',
  warn: 'rgb(230,150,20)',
  over: 'rgb(210,40,45)',
};

/** ratio → βαθμίδα (επαρκές/οριακό/ανεπαρκές). */
export function utilizationBand(ratio: number): UtilizationBand {
  if (ratio > UTILIZATION_WARN_MAX) return 'over';
  if (ratio > UTILIZATION_OK_MAX) return 'warn';
  return 'ok';
}

/** ratio → translucent χρώμα γεμίσματος footprint. */
export function utilizationFillColor(ratio: number): string {
  return FILL[utilizationBand(ratio)];
}

/** βαθμίδα → solid χρώμα υπομνήματος. */
export function utilizationLegendColor(band: UtilizationBand): string {
  return LEGEND[band];
}
