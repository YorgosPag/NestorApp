/**
 * Η ΠΡΟΣΦΟΡΑ ενεργειών ανά κατάσταση (ADR-ACC-010 §2.1.1 Φ9-Β) — βγαίνει από τον ΙΔΙΟ πίνακα που κρίνει τη μετάβαση,
 * άρα κάθε κουμπί που δείχνει η οθόνη είναι μετάβαση που ο γραφέας δέχεται, και το LOCKED δεν δείχνει κανένα.
 */

import { decideFiscalPeriodTransition, fiscalPeriodActionsFrom } from '../fiscal-period-transitions';
import type { FiscalPeriod, FiscalPeriodAction, FiscalPeriodStatus } from '../../types/fiscal-period';

const ALL_ACTIONS: readonly FiscalPeriodAction[] = ['close', 'lock', 'reopen'];

function periodIn(status: FiscalPeriodStatus): FiscalPeriod {
  return {
    periodId: '2026-07', fiscalYear: 2026, periodNumber: 7, startDate: '2026-07-01', endDate: '2026-07-31', status,
    closedAt: null, closedBy: null, lockedAt: null, lockedBy: null, companyId: 'comp_a',
    reopenedAt: null, reopenedBy: null, reopenReason: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('fiscalPeriodActionsFrom', () => {
  it.each([
    ['OPEN', ['close']],
    ['CLOSED', ['lock', 'reopen']],
    ['LOCKED', []],
  ] as const)('%s ⇒ %j', (status, expected) => {
    expect(fiscalPeriodActionsFrom(status)).toEqual(expected);
  });

  it.each(['OPEN', 'CLOSED', 'LOCKED'] as const)('%s: προσφέρεται ΑΚΡΙΒΩΣ ό,τι δέχεται ο γραφέας', (status) => {
    const accepted = ALL_ACTIONS.filter((action) =>
      decideFiscalPeriodTransition(periodIn(status), { action, userId: 'u', reason: 'r' }, '2026-11-07').kind === 'apply');
    expect(fiscalPeriodActionsFrom(status)).toEqual(accepted);
  });
});
