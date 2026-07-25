/**
 * Anchor — `isOptionalOwnersValid` vs `isOwnersValid` (ADR-708 / Ε-15).
 *
 * These two predicates answer DIFFERENT questions and must never be collapsed:
 *  - `isOwnersValid`         → "at least one owner is mandatory" (sale, reservation)
 *  - `isOptionalOwnersValid` → "empty is a legitimate state"     (project landowners)
 *
 * Ε-15 was caused by a consumer that rendered `OwnersList allowEmpty` but gated
 * its save with `isOwnersValid`, which rejects `[]`.
 *
 * @module lib/ownership/__tests__/owner-utils-optional
 */

import { isOwnersValid, isOptionalOwnersValid } from '@/lib/ownership/owner-utils';
import type { PropertyOwnerEntry } from '@/types/ownership-table';

function owner(contactId: string, ownershipPct: number): PropertyOwnerEntry {
  return { contactId, name: `name-${contactId}`, ownershipPct, role: 'landowner', paymentPlanId: null };
}

describe('isOptionalOwnersValid', () => {
  it('accepts an empty list — this is the whole point of the predicate', () => {
    expect(isOptionalOwnersValid([])).toBe(true);
  });

  it('differs from isOwnersValid ONLY on the empty list', () => {
    // The exact divergence that Ε-15 turned into a silently dropped save.
    expect(isOwnersValid([])).toBe(false);
    expect(isOptionalOwnersValid([])).toBe(true);
  });

  it('still rejects an owner without a selected contact', () => {
    expect(isOptionalOwnersValid([owner('', 100)])).toBe(false);
  });

  it('accepts a single fully specified owner', () => {
    expect(isOptionalOwnersValid([owner('c1', 100)])).toBe(true);
  });

  it('still enforces the 100% rule for multiple owners', () => {
    expect(isOptionalOwnersValid([owner('c1', 60), owner('c2', 40)])).toBe(true);
    expect(isOptionalOwnersValid([owner('c1', 60), owner('c2', 30)])).toBe(false);
  });

  it('restates no rule of its own — non-empty input always matches isOwnersValid', () => {
    const cases: PropertyOwnerEntry[][] = [
      [owner('c1', 100)],
      [owner('', 100)],
      [owner('c1', 50), owner('c2', 50)],
      [owner('c1', 50), owner('c2', 49)],
      [owner('c1', 50), owner('', 50)],
    ];
    for (const owners of cases) {
      expect(isOptionalOwnersValid(owners)).toBe(isOwnersValid(owners));
    }
  });
});
