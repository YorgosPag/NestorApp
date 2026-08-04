/**
 * ADR-745 Φ3α — acquisition status domain logic.
 *
 * @jest-environment node
 */

import {
  allowedTransitionsFrom,
  canTransition,
  isAcquisitionStatus,
  summarizeAcquisition,
} from '@/lib/ownership/landowner-acquisition';
import { allocateMillesimalsFromPercentages } from '@/lib/ownership/millesimal-apportionment';
import { ACQUISITION_STATUSES, type LandownerEntry } from '@/types/ownership-table';

function entry(
  contactId: string,
  pct: number,
  acquisitionStatus?: LandownerEntry['acquisitionStatus'],
): LandownerEntry {
  return {
    contactId,
    name: contactId,
    landOwnershipPct: pct,
    // Through the SSoT, not a copy of its formula (see millesimal-apportionment).
    allocatedShares: allocateMillesimalsFromPercentages([pct])[0],
    ...(acquisitionStatus ? { acquisitionStatus } : {}),
  };
}

describe('isAcquisitionStatus', () => {
  it('accepts every declared status', () => {
    for (const s of ACQUISITION_STATUSES) expect(isAcquisitionStatus(s)).toBe(true);
  });

  it('rejects the shapes Firestore can actually hand us', () => {
    // Old documents have no field at all; hand-edited ones can have anything.
    expect(isAcquisitionStatus(undefined)).toBe(false);
    expect(isAcquisitionStatus(null)).toBe(false);
    expect(isAcquisitionStatus('')).toBe(false);
    expect(isAcquisitionStatus('owned')).toBe(false); // the name we deliberately did NOT use
    expect(isAcquisitionStatus(3)).toBe(false);
  });
});

describe('transitions', () => {
  it('walks the intended path', () => {
    expect(canTransition('prospective', 'under_contract')).toBe(true);
    expect(canTransition('under_contract', 'secured')).toBe(true);
  });

  it('refuses to skip the middle stage', () => {
    expect(canTransition('prospective', 'secured')).toBe(false);
  });

  it('treats first declaration and no-op as always allowed', () => {
    expect(canTransition(undefined, 'secured')).toBe(true);
    expect(canTransition('secured', 'secured')).toBe(true);
  });

  it('leaves NO state without an exit — a wrong entry must be recoverable', () => {
    // Regression pin: `secured` was terminal in the first draft, which meant a
    // mis-click could never be taken back through the only UI that sets it.
    for (const from of ACQUISITION_STATUSES) {
      expect(allowedTransitionsFrom(from).filter(s => s !== from).length).toBeGreaterThan(0);
    }
  });

  it('offers every status when nothing is declared yet', () => {
    expect(allowedTransitionsFrom(undefined)).toEqual(ACQUISITION_STATUSES);
  });

  it('always includes the current status among the options', () => {
    for (const from of ACQUISITION_STATUSES) {
      expect(allowedTransitionsFrom(from)).toContain(from);
    }
  });
});

describe('summarizeAcquisition — the three faces of a percentage', () => {
  it('kind=none when nobody declared, and does NOT claim 0% secured as a finding', () => {
    const s = summarizeAcquisition([entry('a', 50), entry('b', 50)]);
    expect(s.kind).toBe('none');
    expect(s.declaredCount).toBe(0);
    expect(s.undeclaredCount).toBe(2);
  });

  it('kind=complete with 0% when everyone declared and nobody secured', () => {
    // Same securedPct as the case above — different meaning. This pair is the
    // whole reason `kind` exists.
    const s = summarizeAcquisition([
      entry('a', 50, 'prospective'),
      entry('b', 50, 'withdrawn'),
    ]);
    expect(s.kind).toBe('complete');
    expect(s.securedPct).toBe(0);
  });

  it('THE SCENARIO: three siblings at 1/3, two signed the deed, one undeclared', () => {
    const s = summarizeAcquisition([
      entry('a', 33.33, 'secured'),
      entry('b', 33.33, 'secured'),
      entry('c', 33.34),
    ]);
    expect(s.kind).toBe('partial');
    expect(s.securedPct).toBe(66.66);
    expect(s.declaredCount).toBe(2);
    expect(s.undeclaredCount).toBe(1);
  });

  it('counts ONLY explicit secured — never infers from absence', () => {
    const s = summarizeAcquisition([
      entry('a', 40, 'under_contract'),
      entry('b', 30, 'withdrawn'),
      entry('c', 30, 'secured'),
    ]);
    expect(s.securedPct).toBe(30);
  });

  it('does not leak floating point into the UI', () => {
    const s = summarizeAcquisition([entry('a', 33.33, 'secured'), entry('b', 33.33, 'secured')]);
    expect(s.securedPct).toBe(66.66); // not 66.66000000000001
  });

  it('an empty list is none, not a division by zero', () => {
    const s = summarizeAcquisition([]);
    expect(s.kind).toBe('none');
    expect(s.totalCount).toBe(0);
    expect(s.securedPct).toBe(0);
  });

  it('ignores a garbage status stored by hand rather than counting it', () => {
    const rogue = { ...entry('a', 100), acquisitionStatus: 'owned' } as unknown as LandownerEntry;
    const s = summarizeAcquisition([rogue]);
    expect(s.declaredCount).toBe(0);
    expect(s.kind).toBe('none');
  });
});
