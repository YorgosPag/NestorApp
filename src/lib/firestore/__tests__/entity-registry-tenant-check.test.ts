/**
 * ΑΓΚΥΡΑ — **κάθε οντότητα που κληρονομεί ενοικιαστή από γονιό, κρίνει τον γονιό** (ADR-829 §7.1).
 *
 * 🔴 Το `createEntity` παίρνει το `companyId` από τον γονιό. Με `tenantCheck: false`, γονιός ξένου χώρου στο σώμα του
 * αιτήματος γεννούσε εγγραφή **στον ξένο χώρο**: έτσι ζούσαν `building` και `floor`, και το δεύτερο ήταν ανοιχτό σε κάθε
 * `internal_user`. Η ερώτηση εδώ είναι της **κλάσης**: καμία νέα οντότητα με γονιό δεν μπορεί να γεννηθεί χωρίς τον έλεγχο.
 */

import { ENTITY_REGISTRY } from '../entity-creation.types';

describe('ENTITY_REGISTRY — ο έλεγχος του γονιού', () => {
  const inherited = Object.entries(ENTITY_REGISTRY).filter(([, entry]) => entry.hierarchy !== 'tenant-scoped');

  it('υπάρχουν οντότητες που κληρονομούν ενοικιαστή (αλλιώς το επόμενο test είναι κενό)', () => {
    expect(inherited.map(([type]) => type)).toEqual(expect.arrayContaining(['building', 'floor']));
  });

  it.each(inherited)('🔴 %s — κρίνει τον γονιό του', (_type, entry) => {
    expect(entry.tenantCheck).toBe(true);
  });
});
