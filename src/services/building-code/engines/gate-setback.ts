/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Gate Setback — checks buildable footprint derived from per-edge Δ/δ setbacks.
 */

import type { PlotSite } from '@/services/building-code/types/site.types';
import type { GateCheck, GateResult, GateStatus } from '@/services/building-code/types/gate.types';
import { MIN_BUILDABLE_SIDE_M } from '@/services/building-code/constants/setback.constants';

function worstStatus(checks: readonly GateCheck[]): GateStatus {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  if (checks.some((c) => c.status === 'pass')) return 'pass';
  return 'na';
}

/** Run setback gate — buildable footprint, 9m rule, area > 0. */
export function runGateSetback(site: PlotSite | null): GateResult {
  if (!site) {
    return { gateId: 'gateSetback', labelKey: 'gateSetback_title', status: 'na', checks: [] };
  }

  const sr = site.setbackResult;
  if (!sr) {
    return { gateId: 'gateSetback', labelKey: 'gateSetback_title', status: 'na', checks: [] };
  }

  const checks: GateCheck[] = [];

  // B4.1: Buildable footprint computed
  checks.push({
    id: 'gs_footprint',
    labelKey: 'gateSetback_footprint',
    status: sr.buildableFootprint.length >= 3 ? 'pass' : 'fail',
    value: `${sr.buildableFootprint.length} κορυφές`,
  });

  // B4.2: 9m rule — minimum buildable side
  const nineOk = sr.minBuildableSide_m >= MIN_BUILDABLE_SIDE_M;
  checks.push({
    id: 'gs_9m',
    labelKey: 'gateSetback_9m',
    status: nineOk ? 'pass' : 'warn',
    value: `${sr.minBuildableSide_m.toFixed(2)} m`,
    threshold: `≥ ${MIN_BUILDABLE_SIDE_M} m`,
    noteKey: nineOk ? undefined : 'gateSetback_9m_warn',
  });

  // B4.3: Buildable area > 0
  checks.push({
    id: 'gs_area',
    labelKey: 'gateSetback_area',
    status: sr.buildableArea_m2 > 0 ? 'pass' : 'fail',
    value: `${sr.buildableArea_m2.toFixed(1)} m²`,
  });

  return {
    gateId: 'gateSetback',
    labelKey: 'gateSetback_title',
    status: worstStatus(checks),
    checks,
  };
}
