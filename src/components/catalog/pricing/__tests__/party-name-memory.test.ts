/**
 * Σ6 (ζωντανή επαλήθευση ADR-923 «3δ»): νέα συνθήκη με συνεργάτη έλεγε «Επαφή χωρίς όνομα» ως την ανανέωση της όψης.
 * Άγκυρα: ό,τι διάλεξε ο άνθρωπος έχει όνομα **αμέσως**· ο διακομιστής υπερισχύει· χωρίς επιλογή ≠ «χωρίς όνομα».
 */

import type { PricingPartyRef } from '@/subapps/catalog/types/price-list';
import { isUnsetParty, mergePartyNames, withPickedName } from '../party-name-memory';

const ZERVA: PricingPartyRef = { kind: 'contact', contactId: 'cont_zerva' };
const UNSET: PricingPartyRef = { kind: 'contact', contactId: '' };

describe('μνήμη ονομάτων συμβαλλομένων — Σ6', () => {
  it('η επιλογή δίνει όνομα αμέσως, με το κλειδί της όψης', () => {
    expect(withPickedName({}, ZERVA, '  Γεωργία Ζέρβα ')).toEqual({ 'contact:cont_zerva': 'Γεωργία Ζέρβα' });
  });

  it('ο διακομιστής υπερισχύει (μετονομασία δεν σκιάζεται)', () => {
    const picked = withPickedName({}, ZERVA, 'Γεωργία Ζέρβα');
    expect(mergePartyNames({ 'contact:cont_zerva': 'Γ. Ζέρβα ΑΕ' }, picked)['contact:cont_zerva']).toBe('Γ. Ζέρβα ΑΕ');
    expect(mergePartyNames({}, picked)['contact:cont_zerva']).toBe('Γεωργία Ζέρβα');
  });

  it('ίδιο όνομα ⇒ ίδιο αντικείμενο · κενό όνομα ή κενός συμβαλλόμενος ⇒ τίποτα', () => {
    const picked = withPickedName({}, ZERVA, 'Γεωργία Ζέρβα');
    expect(withPickedName(picked, ZERVA, 'Γεωργία Ζέρβα')).toBe(picked);
    expect(withPickedName(picked, ZERVA, '   ')).toBe(picked);
    expect(withPickedName(picked, UNSET, 'Κάποιος')).toBe(picked);
  });

  it('χωρίς επιλογή = είδος, όχι «χωρίς όνομα»', () => {
    expect(isUnsetParty(UNSET)).toBe(true);
    expect(isUnsetParty({ kind: 'workspace', companyId: ' ' })).toBe(true);
    expect(isUnsetParty(ZERVA)).toBe(false);
  });
});
