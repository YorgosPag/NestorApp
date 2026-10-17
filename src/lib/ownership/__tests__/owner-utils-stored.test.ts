/**
 * ADR-244 · ADR-915 §26 — `readStoredOwners`: ο ΕΝΑΣ αναγνώστης ωμών `commercial.owners`.
 */

import { readStoredOwners } from '@/lib/ownership/owner-utils';

describe('readStoredOwners', () => {
  it('κρατά σειρά, κόβει κενά, και μερίδιο μόνο όταν είναι πεπερασμένος αριθμός (ποτέ μαντεψιά)', () => {
    expect(readStoredOwners([
      { contactId: ' cont_a ', ownershipPct: 60 },
      { contactId: 'cont_b', ownershipPct: '40' },
      { contactId: '', ownershipPct: 10 },
      { ownershipPct: 10 },
      null,
      { contactId: 'cont_c', ownershipPct: Number.NaN },
    ])).toEqual([
      { contactId: 'cont_a', ownershipPct: 60 },
      { contactId: 'cont_b', ownershipPct: null },
      { contactId: 'cont_c', ownershipPct: null },
    ]);
  });

  it('όχι πίνακας ⇒ κανείς', () => {
    expect(readStoredOwners(undefined)).toEqual([]);
    expect(readStoredOwners({ contactId: 'cont_a' })).toEqual([]);
  });
});
