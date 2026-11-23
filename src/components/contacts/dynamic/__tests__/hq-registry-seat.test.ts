/**
 * Άγκυρες — η «Διόρθωση έδρας» του ΓΕΜΗ με ΑΛΛΗ διεύθυνση αδειάζει και την ιεραρχία (ADR-332 §D35 · ADR-948 §8.7.4)
 *
 * 🔴 Το σφάλμα (μετρημένο ζωντανά, ARIES Α.Ε., παραγωγή `6c90995`, 2026-11-23): έδρα «Ωραιόκαστρον» με Δήμο
 * Ωραιοκάστρου ⇒ «Διόρθωση έδρας» (πόλη ΘΕΣΣΑΛΟΝΙΚΗ, `replace`) ⇒ αποθηκεύτηκε `city: ΘΕΣΣΑΛΟΝΙΚΗ` ·
 * `settlementId: null` δίπλα σε `municipalityName: Δήμος Ωραιοκάστρου` · `municipalityId: municipality:0714`.
 * Η πρόταση περνούσε από το `applyHqEditorChange`, όπου η ιεραρχία **μένει** — σωστό για συμπλήρωση, λάθος για
 * αντικατάσταση.
 */

import { initialFormData, type CompanyAddress, type ContactFormData } from '@/types/ContactFormTypes';
import type { SeatFields } from '@/lib/company/contact-registry-comparison';
import { registrySeatAsAddressFields } from '@/lib/company/registry-form-acceptance';
import { applyHqRegistrySeat } from '../addresses-section-form-mapping';

const HQ: CompanyAddress = {
  id: 'addr_hq', type: 'headquarters', street: 'ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ', number: '', postalCode: '57013',
  city: 'Ωραιόκαστρον', country: 'GR', settlementId: 'settlement:0714010101',
  communityName: 'Δημοτική Κοινότητα Ωραιοκάστρου', municipalUnitName: 'Δημοτική Ενότητα Ωραιοκάστρου',
  municipalityName: 'Δήμος Ωραιοκάστρου', municipalityId: 'municipality:0714',
  regionalUnitName: 'Περιφερειακή Ενότητα Θεσσαλονίκης', regionName: 'Περιφέρεια Κεντρικής Μακεδονίας',
  decentAdminName: 'Αποκεντρωμένη Διοίκηση Μακεδονίας - Θράκης', majorGeoName: 'Βόρεια Ελλάδα',
};
const BRANCH: CompanyAddress = { id: 'addr_b', type: 'branch', street: 'Λαγκαδά', number: '200', postalCode: '56430', city: 'Σταυρούπολη' };
/** Το ΓΕΜΗ λέει «χωρίς αριθμό» (ADR-948 §8.7.1). */
const SEAT: SeatFields = { street: 'ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ', number: null, postalCode: '57013', city: 'ΘΕΣΣΑΛΟΝΙΚΗ' };

function form(): ContactFormData {
  return { ...initialFormData, type: 'company', companyName: 'ARIES', companyAddresses: [HQ, BRANCH] };
}

describe('applyHqRegistrySeat — η έδρα του ΓΕΜΗ ως μονάδα', () => {
  it('Ε1 replace ⇒ κανένα επίπεδο της παλιάς ιεραρχίας δεν επιβιώνει (το περιστατικό)', () => {
    const hq = applyHqRegistrySeat(form(), registrySeatAsAddressFields(SEAT, 'replace'), 'replace').companyAddresses?.[0];

    expect(hq?.city).toBe('ΘΕΣΣΑΛΟΝΙΚΗ');
    expect(hq?.settlementId).toBeNull();
    expect(hq?.municipalityId).toBeNull();
    expect(hq?.municipalityName).toBe('');
    expect(hq?.municipalUnitName).toBe('');
    expect(hq?.communityName).toBe('');
    expect(hq?.regionalUnitName).toBe('');
    expect(hq?.regionName).toBe('');
    expect(hq?.decentAdminName).toBe('');
    expect(hq?.majorGeoName).toBe('');
  });

  it('Ε2 complete ⇒ η ιεραρχία μένει (η ίδια διεύθυνση συμπληρώνεται)', () => {
    const fields = registrySeatAsAddressFields({ street: null, number: null, postalCode: '57013', city: null }, 'complete');
    const hq = applyHqRegistrySeat(form(), fields, 'complete').companyAddresses?.[0];

    expect(hq?.city).toBe('Ωραιόκαστρον');
    expect(hq?.settlementId).toBe('settlement:0714010101');
    expect(hq?.municipalityId).toBe('municipality:0714');
    expect(hq?.municipalityName).toBe('Δήμος Ωραιοκάστρου');
  });

  it('Ε3 replace ⇒ ταυτότητα/τύπος/χώρα μένουν, τα υποκαταστήματα άθικτα (ίδια αναφορά)', () => {
    const next = applyHqRegistrySeat(form(), registrySeatAsAddressFields(SEAT, 'replace'), 'replace');

    expect(next.companyAddresses?.[0]).toMatchObject({ id: 'addr_hq', type: 'headquarters', country: 'GR', number: '' });
    expect(next.companyAddresses?.[1]).toBe(BRANCH);
  });
});
