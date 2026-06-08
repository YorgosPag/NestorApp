/**
 * ADR-427 — Stage 1 Demand: Discharge Units (EN 12056-2, pluggable standard).
 *
 * EN 12056-2 models drainage demand as **Discharge Units (DU)** per appliance; the peak
 * wastewater flow is Qww = K·√(ΣDU) (K = frequency factor; 0.5 for dwellings). This table
 * is the pilot standard — the widely-cited EN 12056-2 **System I** appliance figures
 * (partially-filled branch discharge pipes, the European/Greek default). The standard is
 * **pluggable** (`DischargeDemandStandard`) so a different code (BS EN 12056, DIN 1986-100,
 * UPC fixture units) is a new table, never an engine change.
 *
 * Also owns the **minimum branch DN per appliance** (EN 12056-2): a WC branch is always
 * ≥ DN100 regardless of how few DU it carries — a hard physical floor the router propagates
 * up the spine, distinct from the ΣDU→DN sizing curve.
 *
 * @see ../../../bim/sanitary/sanitary-symbol-spec.ts (SanitaryKind)
 * @see ./drainage-sizing.ts (ΣDU → DN curve)
 */

/** Per-appliance EN 12056-2 demand: DU + the minimum branch diameter (mm) it requires. */
export interface ApplianceDischarge {
  readonly dischargeUnits: number;
  readonly minBranchDiameterMm: number;
}

/** A pluggable discharge-demand standard (the DU + min-branch-DN source). */
export interface DischargeDemandStandard {
  readonly id: string;
  /** Frequency factor K for Qww = K·√ΣDU (transparency / report). */
  readonly frequencyFactorK: number;
  /** DU + min branch DN for an appliance kind; `null` ⇒ kind not in this standard. */
  discharge(terminalKind: string): ApplianceDischarge | null;
}

/**
 * EN 12056-2 System I Discharge Units + minimum branch DN per sanitary kind. WC is the
 * heaviest single appliance (2.0 DU) and forces DN100; basin/bidet are light (0.5 DU, DN40);
 * shower/bath/floor-drain sit at DN50. (floor-drain is included for completeness — its Stage 0
 * recognition is a later slice.)
 */
const EN12056_SYSTEM_I: Readonly<Record<string, ApplianceDischarge>> = {
  washbasin: { dischargeUnits: 0.5, minBranchDiameterMm: 40 },
  bidet: { dischargeUnits: 0.5, minBranchDiameterMm: 40 },
  shower: { dischargeUnits: 0.6, minBranchDiameterMm: 50 },
  bathtub: { dischargeUnits: 0.8, minBranchDiameterMm: 50 },
  'floor-drain': { dischargeUnits: 0.8, minBranchDiameterMm: 50 },
  wc: { dischargeUnits: 2.0, minBranchDiameterMm: 100 },
};

/** The pilot discharge-demand standard (EN 12056-2 System I, dwellings K = 0.5). */
export const EN12056_DEMAND_STANDARD: DischargeDemandStandard = {
  id: 'EN12056-2/SystemI',
  frequencyFactorK: 0.5,
  discharge(terminalKind: string): ApplianceDischarge | null {
    return EN12056_SYSTEM_I[terminalKind] ?? null;
  },
};

/** Peak wastewater flow Qww (l/s) = K·√ΣDU — for the calc report (not used for sizing v1). */
export function peakWastewaterFlow(standard: DischargeDemandStandard, sumDU: number): number {
  return standard.frequencyFactorK * Math.sqrt(Math.max(0, sumDU));
}
