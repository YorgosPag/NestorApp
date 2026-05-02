/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Pure ΝΟΚ gate runner functions.
 * All functions are stateless — no side effects, no React.
 *
 * NOTE: runGateBrief (Gate 2 — Brief Application) intentionally omitted in
 * Phase 1 — depends on BriefData type not yet ported. Will be added in Phase 2.
 */

import type { PlotSite, AreaRegime } from '@/services/building-code/types/site.types';
import type { GateCheck, GateResult, GateStatus } from '@/services/building-code/types/gate.types';
import { runGateBonuses } from '@/services/building-code/engines/gate-bonuses';
import { runGateSetback } from '@/services/building-code/engines/gate-setback';

// ─── Minimum plot requirements (ΝΟΚ Άρθρο 7) ────────────────────────────────

const MIN_AREA_M2: Record<AreaRegime, number> = {
  in_plan: 200,
  in_settlement: 200,
  out_of_plan: 4000,
};

const MIN_FRONTAGE_M: Record<AreaRegime, number> = {
  in_plan: 8,
  in_settlement: 8,
  out_of_plan: 45,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function worstStatus(checks: readonly GateCheck[]): GateStatus {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  if (checks.some((c) => c.status === 'pass')) return 'pass';
  return 'na';
}

// ─── Gate 0 internal helpers (split for ≤40-line function rule) ─────────────

function buildG0AreaCheck(site: PlotSite, minArea: number, exArea?: number): GateCheck {
  const status: GateStatus =
    site.area >= minArea ? 'pass'
    : exArea !== undefined && site.area >= exArea ? 'warn'
    : 'fail';
  return {
    id: 'g0_area',
    labelKey: 'gate0_area',
    status,
    value: `${site.area.toFixed(2)} m²`,
    threshold: `≥ ${minArea} m²`,
    noteKey: status === 'warn' ? 'gate0_area_exception' : undefined,
  };
}

function buildG0FrontageCheck(
  site: PlotSite,
  minFrontage: number,
  exFrontage?: number,
): GateCheck {
  const maxFrontageLength = Math.max(...site.frontages.map((f) => f.frontageLength));
  const status: GateStatus =
    maxFrontageLength >= minFrontage ? 'pass'
    : exFrontage !== undefined && maxFrontageLength >= exFrontage ? 'warn'
    : 'fail';
  return {
    id: 'g0_frontage',
    labelKey: 'gate0_frontage',
    status,
    value: `${maxFrontageLength.toFixed(2)} m`,
    threshold: `≥ ${minFrontage} m`,
    noteKey: status === 'warn' ? 'gate0_frontage_exception' : undefined,
  };
}

function buildG0ElevationCheck(site: PlotSite): GateCheck {
  // Elevation is considered "not set" when all Z values are at default (0).
  const hasElevation =
    site.frontages.some((f) => f.sidewalkLevel !== 0) || site.naturalTerrainLevel !== 0;
  return {
    id: 'g0_elevation',
    labelKey: 'gate0_elevation',
    status: hasElevation ? 'pass' : 'warn',
    noteKey: hasElevation ? undefined : 'gate0_elevation_warn',
  };
}

// ─── Gate 0: Αρτιότητα & Οικοδομησιμότητα ───────────────────────────────────

export function runGate0(site: PlotSite | null): GateResult {
  if (!site) {
    return { gateId: 'gate0', labelKey: 'gate0_title', status: 'na', checks: [] };
  }

  // Zone-specific αρτιότητα limits take priority over ΝΟΚ hardcoded defaults.
  const minArea = site.artiotita?.rule.area_m2 ?? MIN_AREA_M2[site.areaRegime];
  const minFrontage = site.artiotita?.rule.frontage_m ?? MIN_FRONTAGE_M[site.areaRegime];
  const exArea = site.artiotita?.exception?.area_m2;
  const exFrontage = site.artiotita?.exception?.frontage_m;

  const checks: GateCheck[] = [
    buildG0AreaCheck(site, minArea, exArea),
    buildG0FrontageCheck(site, minFrontage, exFrontage),
    buildG0ElevationCheck(site),
  ];

  return {
    gateId: 'gate0',
    labelKey: 'gate0_title',
    status: worstStatus(checks),
    checks,
  };
}

// ─── Gate 5: Όροι Δόμησης — ΣΔ / Κάλυψη / Ακάλυπτοι ─────────────────────────

export function runGate5(site: PlotSite | null): GateResult {
  if (!site) {
    return { gateId: 'gate5', labelKey: 'gate5_title', status: 'na', checks: [] };
  }

  const checks: GateCheck[] = [
    {
      id: 'g5_synt_efarm',
      labelKey: 'gate5_synt_efarm',
      status: 'pass',
      value: site.syntEfarm.toFixed(2),
    },
    {
      id: 'g5_buildable',
      labelKey: 'gate5_buildable',
      status: 'pass',
      value: `${site.maxBuildableM2.toFixed(1)} m²`,
    },
    {
      id: 'g5_coverage',
      labelKey: 'gate5_coverage',
      status: 'pass',
      value: `${site.maxCoverageM2.toFixed(1)} m²`,
      threshold: `${site.maxCoveragePct.toFixed(0)}%`,
    },
    {
      id: 'g5_open',
      labelKey: 'gate5_open',
      status: 'pass',
      value: `${site.mandatoryOpenM2.toFixed(1)} m²`,
    },
    {
      id: 'g5_height',
      labelKey: 'gate5_height',
      status: 'pass',
      value: `${site.maxHeight.toFixed(1)} m`,
    },
  ];

  return {
    gateId: 'gate5',
    labelKey: 'gate5_title',
    status: worstStatus(checks),
    checks,
  };
}

// ─── Gate 22: Ιδεατό Στερεό — Έλεγχος Ύψους Ανά Πρόσωπο ─────────────────────

/**
 * Τμήμα Α κατακόρυφο: H_limit = max(1.5 × Π, 7.5 m), μετρημένο από Z_κράσπεδο.
 * Αν maxHeight ≤ H_limit → PASS. Αν maxHeight > H_limit → WARN.
 */
function buildG22FrontageCheck(
  site: PlotSite,
  frontage: PlotSite['frontages'][number],
  i: number,
  allZero: boolean,
): GateCheck {
  const piEff = Math.max(
    frontage.streetWidth - frontage.prassia_m - (frontage.oppositeSetback_m ?? 0),
    0,
  );
  const hFromPi = 1.5 * piEff;
  const hLimit = Math.max(hFromPi, 7.5);
  const exceedsVertical = site.maxHeight > hLimit;

  const piLabel = piEff < frontage.streetWidth
    ? `Π_eff=${piEff.toFixed(1)} m`
    : `Π=${frontage.streetWidth.toFixed(0)} m`;

  return {
    id: `g22_h_p${i + 1}`,
    labelKey: 'gate22_h_per_frontage',
    status: allZero ? 'warn' : exceedsVertical ? 'warn' : 'pass',
    value: `${frontage.label}: ${site.maxHeight.toFixed(1)} m`,
    threshold: `≤ ${hLimit.toFixed(1)} m  (${piLabel})`,
    noteKey: allZero
      ? 'gate22_z_not_set'
      : exceedsVertical
      ? 'gate22_enters_keklimeno'
      : undefined,
  };
}

export function runGate22(site: PlotSite | null): GateResult {
  if (!site) {
    return { gateId: 'gate22', labelKey: 'gate22_title', status: 'na', checks: [] };
  }

  const allZero =
    site.frontages.every((f) => f.sidewalkLevel === 0) && site.naturalTerrainLevel === 0;

  const checks: GateCheck[] = site.frontages.map((f, i) =>
    buildG22FrontageCheck(site, f, i, allZero),
  );

  return {
    gateId: 'gate22',
    labelKey: 'gate22_title',
    status: worstStatus(checks),
    checks,
  };
}

// ─── Gate 3: ΡΓ / ΟΓ — Ρυμοτομικές / Οικοδομικές Γραμμές & Πρασιά ────────────

/**
 * Ελέγχει ανά πρόσωπο αν η πρασιά (ΟΓ ≠ ΡΓ) έχει οριστεί.
 * Αν RG_isEqualToOG=false και prassia_m=0 → WARN (δεν ορίστηκε).
 * Αν RG_isEqualToOG=true → PASS (δόμηση έως ΡΓ επιτρεπτή).
 */
export function runGate3(site: PlotSite | null): GateResult {
  if (!site) {
    return { gateId: 'gate3', labelKey: 'gate3_title', status: 'na', checks: [] };
  }

  const checks: GateCheck[] = site.frontages.map((f, i) => {
    const id = `g3_rg_p${i + 1}`;
    if (f.RG_isEqualToOG) {
      return {
        id,
        labelKey: 'gate3_og_eq_rg',
        status: 'pass' as GateStatus,
        value: `${f.label}: ΟΓ=ΡΓ`,
      };
    }
    const hasPrassia = f.prassia_m > 0;
    return {
      id,
      labelKey: 'gate3_prassia',
      status: (hasPrassia ? 'pass' : 'warn') as GateStatus,
      value: hasPrassia
        ? `${f.label}: ${f.prassia_m.toFixed(2)} m`
        : `${f.label}: —`,
      noteKey: hasPrassia ? undefined : 'gate3_prassia_warn',
    };
  });

  return {
    gateId: 'gate3',
    labelKey: 'gate3_title',
    status: worstStatus(checks),
    checks,
  };
}

// ─── Combined runner ──────────────────────────────────────────────────────────

/** Run all implemented gates and return results in display order. */
export function runAllGates(site: PlotSite | null): readonly GateResult[] {
  return [
    runGate0(site),
    runGate3(site),
    runGate5(site),
    runGate22(site),
    runGateBonuses(site),
    runGateSetback(site),
  ];
}
