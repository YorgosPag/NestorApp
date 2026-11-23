/**
 * Άγκυρες — η ιεραρχία της έδρας ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ από τη φόρμα ιεραρχίας (ADR-332 §D34)
 *
 * 🔴 Το σφάλμα (μετρημένο ζωντανά, ARIES Α.Ε., 2026-11-23): ✕ ή ελεύθερο κείμενο στην πόλη
 * καθάριζε τα επίπεδα στη φόρμα, αλλά το `projectAddressVocabulary` παρέλειπε τα κενά ⇒ η
 * εγγραφή κρατούσε «Δήμος Θεσσαλονίκης» με `municipalityId: null` δίπλα σε «Ωραιόκαστρο».
 */

import type { CompanyAddress } from '@/types/ContactFormTypes';
import { EMPTY_VALUE, type AddressWithHierarchyValue } from '@/components/shared/addresses/address-with-hierarchy-config';
import { hierarchyToHqBranch } from '../use-hq-address-mutations';

const STALE_HQ: CompanyAddress = {
  id: 'addr_hq', type: 'headquarters', street: 'ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ', number: '', postalCode: '57013',
  city: 'Θεσσαλονίκη', country: 'GR', settlementId: 'settlement:thess',
  municipalUnitName: 'Δημοτική Ενότητα Θεσσαλονίκης',
  municipalityName: 'Δήμος Θεσσαλονίκης', municipalityId: 'municipality:thess',
  regionalUnitName: 'Περιφερειακή Ενότητα Θεσσαλονίκης',
};

function formValue(partial: Partial<AddressWithHierarchyValue>): AddressWithHierarchyValue {
  return {
    ...EMPTY_VALUE,
    street: 'ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ', postalCode: '57013', country: 'GR',
    ...partial,
  };
}

describe('hierarchyToHqBranch — η φόρμα ιεραρχίας ΕΙΝΑΙ η ιεραρχία', () => {
  it('Ε1 ελεύθερο κείμενο πόλης (καθαρισμένα επίπεδα) ⇒ κανένα παλιό όνομα δήμου δεν επιβιώνει', () => {
    const next = hierarchyToHqBranch(STALE_HQ, formValue({ settlementName: 'Ωραιόκαστρο' }), 'Ωραιόκαστρο');

    expect(next.city).toBe('Ωραιόκαστρο');
    expect(next.settlementId).toBeNull();
    expect(next.municipalityName).toBe('');
    expect(next.municipalityId).toBeNull();
    expect(next.municipalUnitName).toBe('');
    expect(next.regionalUnitName).toBe('');
  });

  it('Ε2 επιλογή οικισμού ⇒ γράφεται ολόκληρη η νέα διαδρομή', () => {
    const next = hierarchyToHqBranch(STALE_HQ, formValue({
      settlementId: 'settlement:0714010101', settlementName: 'Ωραιόκαστρον',
      municipalUnitName: 'Δημοτική Ενότητα Ωραιοκάστρου',
      municipalityId: 'municipality:0714', municipalityName: 'Δήμος Ωραιοκάστρου',
      regionalUnitName: 'Περιφερειακή Ενότητα Θεσσαλονίκης',
    }), 'Ωραιόκαστρον');

    expect(next.settlementId).toBe('settlement:0714010101');
    expect(next.municipalityId).toBe('municipality:0714');
    expect(next.municipalityName).toBe('Δήμος Ωραιοκάστρου');
    expect(next.municipalUnitName).toBe('Δημοτική Ενότητα Ωραιοκάστρου');
  });

  it('Ε3 τα μη διοικητικά πεδία της εγγραφής μένουν (ταυτότητα, τύπος)', () => {
    const next = hierarchyToHqBranch(STALE_HQ, formValue({ settlementName: 'Ωραιόκαστρο' }), 'Ωραιόκαστρο');

    expect(next.id).toBe('addr_hq');
    expect(next.type).toBe('headquarters');
    expect(next.street).toBe('ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ');
  });
});
