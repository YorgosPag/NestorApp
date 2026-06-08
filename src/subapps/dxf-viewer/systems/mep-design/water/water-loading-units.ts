/**
 * ADR-426 — Stage 1 Demand: water Loading Units (SSoT, pluggable standard).
 *
 * EN 806 / DIN 1988-300 model demand as **Loading Units (LU / Belastungswert)** per
 * fixture per service; the peak design flow is derived from ΣLU (not a flat sum).
 * This table is the *pilot* standard — values are the widely-cited DIN 1988-3 class
 * figures. The standard is **pluggable** (`DemandStandard`) so a different code (CIPHE
 * BS 8558, EN 12056 for drainage, …) is a new table, never an engine change.
 *
 * NOTE: these are **demand** figures (LU), distinct from `SANITARY_SPEC.supply.diameterMm`
 * which is the nominal connector DN — a fixture's stub size, not how much it draws.
 *
 * @see ../../../bim/sanitary/sanitary-symbol-spec.ts (SanitaryKind)
 */

import type { WaterService } from './water-design-types';

/** Per-service loading units for one fixture kind. */
export interface FixtureLoadingUnits {
  readonly cold: number;
  readonly hot: number;
}

/** A pluggable demand standard (the loading-unit source). */
export interface DemandStandard {
  readonly id: string;
  /** LU for a fixture kind on each service; `null` ⇒ kind not in this standard. */
  loadingUnits(terminalKind: string): FixtureLoadingUnits | null;
}

/**
 * DIN 1988-3 / EN 806 loading units per sanitary kind. WC draws cold only (cistern);
 * mixer fixtures draw both. Bathtub is the heaviest single draw.
 */
const DIN1988_LU: Readonly<Record<string, FixtureLoadingUnits>> = {
  wc: { cold: 1, hot: 0 },
  washbasin: { cold: 1, hot: 1 },
  bidet: { cold: 1, hot: 1 },
  shower: { cold: 2, hot: 2 },
  bathtub: { cold: 4, hot: 4 },
};

/** The pilot demand standard (EN 806 / DIN 1988-3 class loading units). */
export const EN806_DEMAND_STANDARD: DemandStandard = {
  id: 'EN806/DIN1988-3',
  loadingUnits(terminalKind: string): FixtureLoadingUnits | null {
    return DIN1988_LU[terminalKind] ?? null;
  },
};

/** Loading units for one (kind, service), or 0 if the standard lacks the kind. */
export function loadingUnitsFor(
  standard: DemandStandard,
  terminalKind: string,
  service: WaterService,
): number {
  const lu = standard.loadingUnits(terminalKind);
  if (!lu) return 0;
  return service === 'cold' ? lu.cold : lu.hot;
}
