/**
 * ADR-195 (η) — ο CDC γράφει το Ιστορικό επαφής με τη ΔΗΛΩΜΕΝΗ ταυτότητα στοιχείου.
 *
 * 🔴 Μετρημένο ζωντανά (MACON ATEE, `eaud_f7b006e6…`, 29/10): η αλλαγή τύπου τηλεφώνου γραφόταν «Αφαιρέθηκε … mobile»
 * + «Προστέθηκε … main», η έδρα γραφόταν ΔΥΟ φορές (`addresses` + `customFields.companyAddresses`), ο ρόλος με κενή
 * ετικέτα, και το `lastModifiedBy` ως αλλαγή. Τα δεδομένα εδώ είναι το πραγματικό πριν/μετά εκείνης της αποθήκευσης.
 *
 * Σ1 αλλαγή ιδιότητας στοιχείου = ΜΙΑ `modified` · Σ2 κάτοπτρο σωπαίνει όταν άλλαξε η αυθεντία · Σ3 κάτοπτρο που
 * άλλαξε ΜΟΝΟ ΤΟΥ μένει ορατό · Σ4 ρόλος με κλειδί και ετικέτα · Σ5 παλιό στοιχείο χωρίς `id` ⇒ εφεδρεία, όχι σφάλμα ·
 * Σ6 `lastModifiedBy` αγνοείται · Σ7 πεδίο με όνομα prototype ⇒ ευρετικό.
 */

import { deepDiff } from '../deep-diff';
import { CONTACT_AUDIT_SCHEMA } from '../contact-audit-schema';

const STREET = 'Απόλλωνος, Λαγκαδά Πυλαίας';
const ADDRESS_ID = 'addr_41316217-7c2a-4c62-ab79-46f8da8c71b8';

const MACON_BEFORE = {
  type: 'company',
  companyName: 'MACON ATEE',
  phones: [{ number: '2310428900', type: 'mobile', isPrimary: true, countryCode: '+30' }],
  addresses: [
    { street: STREET, city: 'Θεσσαλονίκη', postalCode: '55535', country: 'GR', type: 'work', isPrimary: true },
  ],
  personas: [{ personaType: 'supplier', status: 'active', tradeSpecialties: [] }],
  personaTypes: ['supplier'],
};

const MACON_AFTER = {
  ...MACON_BEFORE,
  phones: [{ number: '2310428900', type: 'main', isPrimary: true, label: '', countryCode: '+30' }],
  addresses: [{
    id: ADDRESS_ID, street: STREET, number: '', city: 'Θεσσαλονίκη', postalCode: '55535', country: 'GR',
    type: 'work', isPrimary: true, label: 'headquarters', settlement: 'Θεσσαλονίκη',
  }],
  customFields: {
    activityType: 'main',
    companyAddresses: [{
      type: 'headquarters', street: STREET, number: '', postalCode: '55535', city: 'Θεσσαλονίκη', country: 'GR',
      id: ADDRESS_ID,
    }],
  },
  lastModifiedBy: 'WKBWEg3DSfcdSbLNJfzGEW3vkct1',
  vatNumber: '094201577',
};

const diff = (before: Record<string, unknown>, after: Record<string, unknown>) =>
  deepDiff(before, after, CONTACT_AUDIT_SCHEMA);

describe('ADR-195 (η) — CDC επαφής με δηλωμένη ταυτότητα', () => {
  const changes = diff(MACON_BEFORE, MACON_AFTER);
  const of = (field: string) => changes.filter((c) => c.field === field);

  it('Σ1 — αλλαγή τύπου τηλεφώνου = ΜΙΑ αλλαγή ιδιότητας, ετικέτα χωρίς ωμό τύπο', () => {
    expect(of('phones')).toEqual([{
      field: 'phones', oldValue: null, newValue: null, label: 'phones', kind: 'collection', op: 'modified',
      itemKey: 'k:2310428900', itemLabel: '2310428900',
      subChanges: [{ subField: 'type', oldValue: 'mobile', newValue: 'main' }],
    }]);
  });

  it('Σ2 — η έδρα γράφεται ΜΙΑ φορά, από την αυθεντία (`customFields.companyAddresses`)', () => {
    expect(of('addresses')).toEqual([]);
    expect(of('customFields.companyAddresses')).toEqual([expect.objectContaining({
      op: 'added', itemKey: `k:${ADDRESS_ID}`, itemLabel: `headquarters — ${STREET} — Θεσσαλονίκη`,
    })]);
  });

  it('Σ6 — το `lastModifiedBy` δεν είναι αλλαγή ανθρώπου', () => {
    expect(of('lastModifiedBy')).toEqual([]);
  });

  it('οι υπόλοιπες αλλαγές μένουν ακέραιες', () => {
    expect(changes.map((c) => c.field)).toEqual([
      'customFields.activityType', 'customFields.companyAddresses', 'phones', 'vatNumber',
    ]);
  });

  it('Σ3 — κάτοπτρο που άλλαξε ΜΟΝΟ ΤΟΥ (απόκλιση) μένει ορατό', () => {
    const drift = diff(MACON_BEFORE, { ...MACON_BEFORE, personaTypes: ['supplier', 'client'] });
    expect(drift).toEqual([expect.objectContaining({ field: 'personaTypes', op: 'added', itemKey: 's:client' })]);
  });

  it('Σ4 — ρόλος: κλειδί και ετικέτα από το `personaType`· το `personaTypes` σωπαίνει', () => {
    const created = diff({}, { personas: MACON_BEFORE.personas, personaTypes: ['supplier'] });
    expect(created).toEqual([expect.objectContaining({
      field: 'personas', op: 'added', itemKey: 'k:supplier', itemLabel: 'supplier',
    })]);
  });

  it('Σ4β — αλλαγή κατάστασης ρόλου = ΜΙΑ αλλαγή ιδιότητας', () => {
    const deactivated = diff(
      { personas: [{ personaType: 'supplier', status: 'active' }] },
      { personas: [{ personaType: 'supplier', status: 'inactive' }] },
    );
    expect(deactivated).toEqual([expect.objectContaining({
      op: 'modified', itemKey: 'k:supplier', subChanges: [{ subField: 'status', oldValue: 'active', newValue: 'inactive' }],
    })]);
  });

  it('Σ5 — παλιό στοιχείο χωρίς `id`: εφεδρεία στο JSON του στοιχείου, χωρίς σφάλμα', () => {
    const legacy = diff({ addresses: [] }, { addresses: [{ street: STREET, type: 'work' }] });
    expect(legacy).toEqual([expect.objectContaining({ op: 'added', itemKey: expect.stringMatching(/^j:/) })]);
  });

  it('Σ7 — πεδίο με όνομα prototype δεν βρίσκει δήλωση', () => {
    const odd = diff({}, { constructor: [{ id: 'x1', name: 'X' }] });
    expect(odd).toEqual([expect.objectContaining({ field: 'constructor', itemKey: 'k:x1', itemLabel: 'X' })]);
  });

  it('αδήλωτη συλλογή: το ευρετικό μένει όπως ήταν', () => {
    const undeclared = diff({}, { entrances: [{ id: 2, name: 'Παραδόσεων', type: 'entrance' }] });
    expect(undeclared).toEqual([expect.objectContaining({ itemKey: 'k:2', itemLabel: 'Παραδόσεων — entrance' })]);
  });
});
