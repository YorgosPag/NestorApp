// =============================================================================
// UC-017: DELAY PREDICTOR — UNIT TESTS
// =============================================================================

import { predictDelays } from '../analyzers/delay-predictor';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-06-01T00:00:00.000Z');
const PAST_START = '2026-04-01';   // 61 days ago
const FUTURE_END = '2026-09-01';   // 92 days away → total ~153 days, elapsed ~40%

function makePhase(overrides: Partial<ConstructionPhase>): ConstructionPhase {
  return {
    id: 'ph_001',
    buildingId: 'bld_001',
    companyId: 'comp_001',
    name: 'Foundation',
    code: 'PH-001',
    order: 1,
    status: 'inProgress',
    plannedStartDate: PAST_START,
    plannedEndDate: FUTURE_END,
    progress: 40,  // on track by default
    ...overrides,
  };
}

function makeTask(overrides: Partial<ConstructionTask>): ConstructionTask {
  return {
    id: 'tsk_001',
    phaseId: 'ph_001',
    buildingId: 'bld_001',
    companyId: 'comp_001',
    name: 'Excavation',
    code: 'TSK-001',
    order: 1,
    status: 'inProgress',
    plannedStartDate: PAST_START,
    plannedEndDate: FUTURE_END,
    progress: 40,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('predictDelays', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns empty array when no phases', () => {
    expect(predictDelays([], [])).toEqual([]);
  });

  it('skips completed phases', () => {
    const phase = makePhase({ status: 'completed' });
    expect(predictDelays([phase], [])).toEqual([]);
  });

  it('flags already-delayed phase with critical severity', () => {
    const phase = makePhase({ status: 'delayed', progress: 5 });
    const result = predictDelays([phase], []);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
    expect(result[0].phaseId).toBe('ph_001');
    expect(result[0].confidence).toBeGreaterThanOrEqual(85);
  });

  it('flags blocked phase as critical', () => {
    const phase = makePhase({ status: 'blocked', progress: 10 });
    const result = predictDelays([phase], []);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
  });

  it('returns no prediction for on-track phase', () => {
    const phase = makePhase({ progress: 40 }); // ~40% elapsed, 40% done
    const result = predictDelays([phase], []);
    expect(result).toHaveLength(0);
  });

  it('returns low severity for small gap (10-19%)', () => {
    const phase = makePhase({ progress: 25 }); // ~40% elapsed, 25% done → 15% gap
    const result = predictDelays([phase], []);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('low');
  });

  it('returns high severity for large gap (35%+)', () => {
    const phase = makePhase({ progress: 0 }); // 40% elapsed, 0% done → 40% gap
    const result = predictDelays([phase], []);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('high');
  });

  it('sorts results by severity descending (critical first)', () => {
    const phases = [
      makePhase({ id: 'ph_low',      progress: 28, name: 'Low'      }), // ~12% gap
      makePhase({ id: 'ph_critical', status: 'delayed', name: 'Crit' }), // delayed
      makePhase({ id: 'ph_high',     progress: 0,  name: 'High'     }), // 40% gap
    ];
    const result = predictDelays(phases, []);
    expect(result[0].phaseId).toBe('ph_critical');
    expect(result[result.length - 1].phaseId).toBe('ph_low');
  });

  it('uses task progress to adjust phase progress', () => {
    const phase = makePhase({ progress: 30 });
    const tasks = [
      makeTask({ phaseId: 'ph_001', progress: 5 }),
      makeTask({ phaseId: 'ph_001', progress: 5 }),
    ];
    // Blended = 30*0.4 + 5*0.6 = 12 + 3 = 15 → gap ~25% → medium severity
    const result = predictDelays([phase], tasks);
    expect(result).toHaveLength(1);
    expect(['medium', 'high']).toContain(result[0].severity);
  });

  it('includes delayNote in reason when available', () => {
    const phase = makePhase({ status: 'delayed', delayNote: 'Αναμονή υλικών' });
    const result = predictDelays([phase], []);
    expect(result[0].reason).toBe('Αναμονή υλικών');
  });

  it('skips phases with invalid dates', () => {
    const phase = makePhase({ plannedStartDate: 'not-a-date', plannedEndDate: 'also-not' });
    expect(predictDelays([phase], [])).toHaveLength(0);
  });
});
