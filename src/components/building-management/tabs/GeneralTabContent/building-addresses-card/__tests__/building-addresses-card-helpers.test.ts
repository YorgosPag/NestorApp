/**
 * ADR-332 — διευθύνσεις του κτιρίου εκτός έργου.
 *
 *   Δ1  `buildingOnlyAddresses`: μόνο όσες ΔΕΝ υπάρχουν στο έργο (κατά ταυτότητα)
 *   Δ2  `buildUnlinkedAddressUpdate`: φεύγει μόνο αυτή · αν ήταν κύρια, κύρια γίνεται η πρώτη που μένει
 *   Δ3  `buildProjectAddressSelection` (εναλλαγή) αφαιρεί μέσα από το ΙΔΙΟ `buildUnlinkedAddressUpdate`
 */

import type { ProjectAddress } from '@/types/project/addresses';

import {
  buildProjectAddressSelection,
  buildUnlinkedAddressUpdate,
  buildingOnlyAddresses,
} from '../building-addresses-card-helpers';

function address(id: string, isPrimary = false): ProjectAddress {
  return { id, isPrimary, street: `Οδός ${id}`, city: 'Ηράκλειο' } as ProjectAddress;
}

describe('building-addresses-card-helpers — διευθύνσεις εκτός έργου', () => {
  it('Δ1 μόνο όσες δεν υπάρχουν στο έργο', () => {
    const local = [address('p1', true), address('own')];
    expect(buildingOnlyAddresses(local, [address('p1'), address('p2')]).map((a) => a.id)).toEqual(['own']);
    expect(buildingOnlyAddresses(local, [])).toHaveLength(2);
    expect(buildingOnlyAddresses([], [address('p1')])).toEqual([]);
  });

  it('Δ2 αποσύνδεση κύριας ⇒ κύρια γίνεται η πρώτη που μένει', () => {
    const next = buildUnlinkedAddressUpdate([address('own', true), address('p1'), address('p2')], 'own');
    expect(next.map((a) => [a.id, a.isPrimary])).toEqual([['p1', true], ['p2', false]]);
    expect(buildUnlinkedAddressUpdate([address('own', true)], 'own')).toEqual([]);
  });

  it('Δ3 η εναλλαγή αφαιρεί με τον ίδιο κανόνα', () => {
    const local = [address('p1', true), address('p2')];
    expect(buildProjectAddressSelection(local, address('p1'))).toEqual(buildUnlinkedAddressUpdate(local, 'p1'));
  });
});
