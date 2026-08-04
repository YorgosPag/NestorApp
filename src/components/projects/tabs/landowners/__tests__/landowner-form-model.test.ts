/**
 * ADR-745 Φ3α — the four synchronisation invariants (Σ1–Σ4).
 *
 * Organised by INVARIANT, not by function. Each of these was a live defect the
 * plan review caught before implementation; a test written next to whichever
 * function happens to own the code today would drift away from the invariant.
 *
 * @jest-environment node
 */

import {
  hasChanges,
  landownersMateriallyChanged,
  pruneStatuses,
  rehydrateStatuses,
  toLandownerEntries,
  toPropertyOwners,
  type AcquisitionStatusMap,
} from '@/components/projects/tabs/landowners/landowner-form-model';
import { allocateMillesimalsFromPercentages } from '@/lib/ownership/millesimal-apportionment';
import type { LandownerEntry, PropertyOwnerEntry } from '@/types/ownership-table';

function owner(contactId: string, pct: number, name = contactId): PropertyOwnerEntry {
  return { contactId, name, ownershipPct: pct, role: 'landowner', paymentPlanId: null };
}

function stored(
  contactId: string,
  pct: number,
  acquisitionStatus?: LandownerEntry['acquisitionStatus'],
): LandownerEntry {
  return {
    contactId,
    name: contactId,
    landOwnershipPct: pct,
    // Through the SSoT, not a copy of its formula: a fixture that claims a value
    // the writer would never produce is a fixture that proves the wrong thing.
    allocatedShares: allocateMillesimalsFromPercentages([pct])[0],
    ...(acquisitionStatus ? { acquisitionStatus } : {}),
  };
}

// ============================================================================
// Σ1 — the status must survive a round trip through Firestore
// ============================================================================

describe('Σ1 — rehydrate', () => {
  it('rebuilds the map from stored entries', () => {
    const map = rehydrateStatuses([stored('a', 50, 'secured'), stored('b', 50, 'prospective')]);
    expect(map).toEqual({ a: 'secured', b: 'prospective' });
  });

  it('skips entries with no status instead of inventing one', () => {
    // Absence means "not declared" — never a silent default to `prospective`.
    expect(rehydrateStatuses([stored('a', 100)])).toEqual({});
  });

  it('skips a stored value that is not a real status', () => {
    const rogue = { ...stored('a', 100), acquisitionStatus: 'owned' } as unknown as LandownerEntry;
    expect(rehydrateStatuses([rogue])).toEqual({});
  });

  it('THE DATA-LOSS CASE: an unrelated save must not wipe recorded statuses', () => {
    // Load → (user changes only the bartex %) → save. Firestore replaces the whole
    // array, so if the map were not rehydrated on load, both signatures below would
    // silently disappear with no error and no message.
    const persistedEntries = [stored('a', 50, 'secured'), stored('b', 50, 'under_contract')];

    const statuses = rehydrateStatuses(persistedEntries);
    const owners = toPropertyOwners(persistedEntries);
    const written = toLandownerEntries(owners, statuses);

    expect(written).toEqual(persistedEntries);
  });
});

// ============================================================================
// Σ2 — a status-only change must be savable
// ============================================================================

describe('Σ2 — dirty check', () => {
  const persistedEntries = [stored('a', 50, 'prospective'), stored('b', 50)];
  const owners = toPropertyOwners(persistedEntries);
  const persistedMap = rehydrateStatuses(persistedEntries);

  it('is clean when nothing moved', () => {
    expect(hasChanges(owners, persistedEntries, null, null, persistedMap)).toBe(false);
  });

  it('is DIRTY when only a status changed — otherwise Save stays disabled forever', () => {
    const changed: AcquisitionStatusMap = { ...persistedMap, a: 'under_contract' };
    expect(hasChanges(owners, persistedEntries, null, null, changed)).toBe(true);
  });

  it('is DIRTY on a first declaration for a previously undeclared owner', () => {
    const changed: AcquisitionStatusMap = { ...persistedMap, b: 'secured' };
    expect(hasChanges(owners, persistedEntries, null, null, changed)).toBe(true);
  });

  it('still notices the changes it always noticed', () => {
    expect(hasChanges(owners, persistedEntries, 40, null, persistedMap)).toBe(true);
    expect(hasChanges([owner('a', 60), owner('b', 40)], persistedEntries, null, null, persistedMap))
      .toBe(true);
  });
});

// ============================================================================
// Σ3 — a status must never migrate to a different person
// ============================================================================

describe('Σ3 — prune', () => {
  it('drops the old key when a row swaps its contact', () => {
    // handleContactSelect replaces contactId in place. Without pruning, picking
    // `a` again later would resurrect a "secured" nobody declared.
    const pruned = pruneStatuses({ a: 'secured' }, [owner('z', 100)]);
    expect(pruned).toEqual({});
  });

  it('drops the key of a removed landowner', () => {
    const pruned = pruneStatuses({ a: 'secured', b: 'prospective' }, [owner('a', 100)]);
    expect(pruned).toEqual({ a: 'secured' });
  });

  it('keeps statuses of rows that merely moved position', () => {
    const map: AcquisitionStatusMap = { a: 'secured', b: 'withdrawn' };
    expect(pruneStatuses(map, [owner('b', 50), owner('a', 50)])).toEqual(map);
  });

  it('returns the SAME object when nothing was pruned (no needless re-render)', () => {
    const map: AcquisitionStatusMap = { a: 'secured' };
    expect(pruneStatuses(map, [owner('a', 100)])).toBe(map);
  });

  it('an empty row cannot hold a status', () => {
    expect(pruneStatuses({ a: 'secured' }, [owner('', 100)])).toEqual({});
  });
});

// ============================================================================
// Σ4 — the impact warning must stay deaf to acquisition status
// ============================================================================

describe('Σ4 — material change is NARROWER than dirty', () => {
  const persistedEntries = [stored('a', 50, 'prospective'), stored('b', 50, 'prospective')];
  const owners = toPropertyOwners(persistedEntries);

  it('a status-only change is dirty but NOT material', () => {
    const changed: AcquisitionStatusMap = { a: 'secured', b: 'prospective' };
    expect(hasChanges(owners, persistedEntries, null, null, changed)).toBe(true);
    expect(landownersMateriallyChanged(owners, persistedEntries)).toBe(false);
  });

  it('a percentage change IS material', () => {
    expect(landownersMateriallyChanged([owner('a', 60), owner('b', 40)], persistedEntries)).toBe(true);
  });

  it('a different person IS material', () => {
    expect(landownersMateriallyChanged([owner('a', 50), owner('c', 50)], persistedEntries)).toBe(true);
  });

  it('adding or removing a landowner IS material', () => {
    expect(landownersMateriallyChanged([owner('a', 100)], persistedEntries)).toBe(true);
  });
});

// ============================================================================
// Converters
// ============================================================================

describe('converters', () => {
  it('omits the status key entirely when undeclared', () => {
    const [written] = toLandownerEntries([owner('a', 100)], {});
    expect('acquisitionStatus' in written).toBe(false);
  });

  it('computes millesimals from the shared SSoT target', () => {
    const [written] = toLandownerEntries([owner('a', 33.33)], {});
    expect(written.allocatedShares).toBe(333);
  });

  it('THE 999 CASE: a list adding up to 100% is stored as a full 1000‰', () => {
    // Millesimals are apportioned across the whole list, not row by row. Three
    // thirds rounded independently wrote 999‰ into Firestore.
    const written = toLandownerEntries(
      [owner('a', 33.33), owner('b', 33.33), owner('c', 33.34)],
      {},
    );
    expect(written.reduce((total, e) => total + e.allocatedShares, 0)).toBe(1000);
  });

  it('gives each landowner THEIR OWN millesimals, in their own row', () => {
    // Apportioning over the list means the shares arrive as a parallel array;
    // reading it off by the wrong index would hand one owner another's stake
    // while every total still added up perfectly.
    const written = toLandownerEntries(
      [owner('a', 20), owner('b', 30), owner('c', 50)],
      {},
    );
    expect(written.map(e => [e.contactId, e.allocatedShares]))
      .toEqual([['a', 200], ['b', 300], ['c', 500]]);
  });

  it('does not hand a millesimal to an owner who declared nothing', () => {
    const written = toLandownerEntries([owner('a', 100), owner('b', 0)], {});
    expect(written[1].allocatedShares).toBe(0);
  });

  it('ignores a status whose contact is not in the list', () => {
    const [written] = toLandownerEntries([owner('a', 100)], { ghost: 'secured' });
    expect('acquisitionStatus' in written).toBe(false);
  });

  it('does not carry acquisition status into the sales-domain shape', () => {
    // toPropertyOwners feeds OwnersList, shared with SellDialog/ReserveDialog.
    const [asOwner] = toPropertyOwners([stored('a', 100, 'secured')]);
    expect('acquisitionStatus' in asOwner).toBe(false);
    expect(asOwner.role).toBe('landowner');
  });
});
