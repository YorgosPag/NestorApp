/**
 * ADR-915 §39.6 — **«πού αναζητά κανείς έναν αριθμό αυτού του μητρώου;»**: παράγεται από τις άδειες (`registryLookupUrl`),
 * ποτέ δεύτερος κατάλογος. Μητρώο χωρίς δημόσια αναζήτηση ή χωρίς άδεια ⇒ `null` — κανένας σύνδεσμος στο κενό.
 */

import {
  PROFESSIONAL_LICENCE_SPECS,
  PROFESSIONAL_LICENCES,
  registryAuthorityLookupUrl,
} from '@/config/professional-licences';

describe('registryAuthorityLookupUrl', () => {
  it('ΥΠΕΝ ⇒ η σελίδα του Μητρώου Ενεργειακών Επιθεωρητών, η ΙΔΙΑ με της άδειας', () => {
    expect(registryAuthorityLookupUrl('ypen')).toBe(PROFESSIONAL_LICENCE_SPECS['energy-inspector'].registryLookupUrl);
  });

  it('αρχή με άδεια ΧΩΡΙΣ δημόσια αναζήτηση (Περιφέρεια) ⇒ null', () => {
    expect(PROFESSIONAL_LICENCE_SPECS['electrical-installer'].registryLookupUrl).toBeNull();
    expect(registryAuthorityLookupUrl('regional-authority')).toBeNull();
  });

  it('αρχή χωρίς καμία άδεια στο λεξιλόγιο ⇒ null (δεν μαντεύεται)', () => {
    const withLicence = new Set(PROFESSIONAL_LICENCES.map((licence) => PROFESSIONAL_LICENCE_SPECS[licence].authority));
    expect(withLicence.has('tee')).toBe(false);
    expect(registryAuthorityLookupUrl('tee')).toBeNull();
  });
});
