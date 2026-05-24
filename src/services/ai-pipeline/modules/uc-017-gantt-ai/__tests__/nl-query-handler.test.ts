// =============================================================================
// UC-017: NATURAL LANGUAGE QUERY HANDLER — UNIT TESTS
// =============================================================================

import { handleNLQuery } from '../analyzers/nl-query-handler';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePhase(overrides: Partial<ConstructionPhase>): ConstructionPhase {
  return {
    id: 'ph_001',
    buildingId: 'bld_001',
    companyId: 'comp_001',
    name: 'Foundation',
    code: 'PH-001',
    order: 1,
    status: 'inProgress',
    plannedStartDate: '2026-05-01',
    plannedEndDate: '2026-09-01',
    progress: 50,
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
    plannedStartDate: '2026-05-01',
    plannedEndDate: '2026-07-01',
    progress: 50,
    ...overrides,
  };
}

const phases = [
  makePhase({ id: 'ph_001', name: 'Θεμελίωση', status: 'delayed' }),
  makePhase({ id: 'ph_002', name: 'Σκελετός', status: 'inProgress' }),
  makePhase({ id: 'ph_003', name: 'Επικάλυψη', status: 'blocked' }),
  makePhase({ id: 'ph_004', name: 'Ολοκλήρωση', status: 'completed' }),
];

const tasks = [
  makeTask({ id: 'tsk_001', phaseId: 'ph_001', name: 'Εκσκαφή', status: 'delayed' }),
  makeTask({ id: 'tsk_002', phaseId: 'ph_002', name: 'Τοιχοποιία', status: 'blocked' }),
  makeTask({ id: 'tsk_003', phaseId: 'ph_003', name: 'Εξωτερικά', status: 'inProgress' }),
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handleNLQuery — delayed_tasks', () => {
  it('detects "καθυστερ" keyword', () => {
    const result = handleNLQuery('Δείξε μου καθυστερημένες εργασίες', phases, tasks);
    expect(result.queryType).toBe('delayed_tasks');
  });

  it('includes delayed phases and tasks in matchedItems', () => {
    const result = handleNLQuery('καθυστερ', phases, tasks);
    const ids = result.matchedItems.map(i => i.id);
    expect(ids).toContain('ph_001');
    expect(ids).toContain('tsk_001');
  });

  it('returns Greek message when no delays', () => {
    const result = handleNLQuery('καθυστερ', [], []);
    expect(result.answer).toMatch(/Δεν υπάρχουν/);
  });
});

describe('handleNLQuery — blocked_tasks', () => {
  it('detects "μπλοκ" keyword', () => {
    const result = handleNLQuery('Ποια είναι μπλοκαρισμένα;', phases, tasks);
    expect(result.queryType).toBe('blocked_tasks');
  });

  it('includes blocked items', () => {
    const result = handleNLQuery('μπλοκ', phases, tasks);
    const ids = result.matchedItems.map(i => i.id);
    expect(ids).toContain('ph_003');
    expect(ids).toContain('tsk_002');
  });
});

describe('handleNLQuery — upcoming_tasks', () => {
  it('detects "σήμερα" keyword', () => {
    const result = handleNLQuery('Τι ξεκινάει σήμερα;', phases, tasks);
    expect(result.queryType).toBe('upcoming_tasks');
  });

  it('detects "επόμεν" keyword', () => {
    const result = handleNLQuery('Επόμενες εργασίες', phases, tasks);
    expect(result.queryType).toBe('upcoming_tasks');
  });
});

describe('handleNLQuery — phase_status', () => {
  it('detects "κατάσταση" keyword', () => {
    const result = handleNLQuery('Ποια είναι η κατάσταση των φάσεων;', phases, tasks);
    expect(result.queryType).toBe('phase_status');
  });

  it('returns summary with counts', () => {
    const result = handleNLQuery('κατάσταση', phases, tasks);
    expect(result.answer).toMatch(/Φάσεις/);
    expect(result.matchedItems.length).toBe(phases.length);
  });
});

describe('handleNLQuery — general fallback', () => {
  it('returns general for unrecognized query', () => {
    const result = handleNLQuery('Πες μου κάτι για το έργο', phases, tasks);
    expect(result.queryType).toBe('general');
  });

  it('always returns a non-empty answer', () => {
    const result = handleNLQuery('', [], []);
    expect(result.answer.length).toBeGreaterThan(0);
  });
});
