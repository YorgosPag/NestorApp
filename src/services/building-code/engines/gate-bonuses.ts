/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Gate Bonuses — checks ΝΟΚ bonus eligibility and summarizes active bonuses.
 */

import type { PlotSite } from '@/services/building-code/types/site.types';
import type { GateCheck, GateResult, GateStatus } from '@/services/building-code/types/gate.types';

function worstStatus(checks: readonly GateCheck[]): GateStatus {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  if (checks.some((c) => c.status === 'pass')) return 'pass';
  return 'na';
}

/** Run bonus gate — eligibility, summary, and combo warnings. */
export function runGateBonuses(site: PlotSite | null): GateResult {
  if (!site) {
    return { gateId: 'gateBonuses', labelKey: 'gateBonuses_title', status: 'na', checks: [] };
  }

  const checks: GateCheck[] = [];

  // Check 1: Eligibility
  checks.push({
    id: 'gb_eligible',
    labelKey: 'gateBonuses_eligible',
    status: site.nokBonusEligible ? 'pass' : 'na',
    value: site.nokBonusEligible ? 'Ναι' : 'Όχι',
  });

  if (!site.nokBonusEligible) {
    return { gateId: 'gateBonuses', labelKey: 'gateBonuses_title', status: 'na', checks };
  }

  // Check 2: Bonus summary
  const { bonusResult } = site;
  const hasBonus = bonusResult.totalExtraSd > 0 || bonusResult.totalExtraCoverageM2 !== 0;
  checks.push({
    id: 'gb_summary',
    labelKey: 'gateBonuses_summary',
    status: hasBonus ? 'pass' : 'na',
    value: hasBonus
      ? `+ΣΔ ${bonusResult.totalExtraSd.toFixed(2)}, Δομ. ${bonusResult.adjustedMaxBuildableM2.toFixed(1)} m²`
      : '—',
  });

  // Check 3: Warnings
  if (bonusResult.warnings.length > 0) {
    checks.push({
      id: 'gb_warnings',
      labelKey: 'gateBonuses_warnings',
      status: 'warn',
      value: String(bonusResult.warnings.length),
      noteKey: bonusResult.warnings[0],
    });
  }

  return {
    gateId: 'gateBonuses',
    labelKey: 'gateBonuses_title',
    status: worstStatus(checks),
    checks,
  };
}
