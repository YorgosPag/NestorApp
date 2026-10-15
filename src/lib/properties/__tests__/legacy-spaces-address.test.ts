/**
 * @fileoverview ADR-840 Σ3 — η παλιά διεύθυνση `/spaces/properties` **μεταφράζεται**, δεν αλλάζει απλώς διαδρομή.
 *
 * Σελιδοδείκτες, email και ειδοποιήσεις δεν διορθώνονται αναδρομικά: αν η ανακατεύθυνση έχανε το `?propertyId=`, ο
 * σύνδεσμος «δες το Δ3» θα άνοιγε την οθόνη **χωρίς** το Δ3. Αν το κρατούσε αυτούσιο, θα άνοιγε την **καρτέλα**
 * (στο `/properties` το `propertyId` σημαίνει άλλο πράγμα — ADR-777 §8.30).
 */

import { legacySpacesPropertiesQuery } from '../legacy-spaces-address';

describe('legacySpacesPropertiesQuery', () => {
  it('καμία παράμετρος ⇒ η όψη «λίστα» (η παλιά σελίδα ΗΤΑΝ η λίστα)', () => {
    expect(legacySpacesPropertiesQuery({})).toBe('?view=list');
  });

  it('`propertyId` ⇒ `selected` — επιλεγμένη γραμμή, ΟΧΙ καρτέλα', () => {
    // ⛔ MUTATION: κράτα το `propertyId` αυτούσιο ⇒ κόκκινο (θα άνοιγε την καρτέλα αντί για τη λίστα).
    expect(legacySpacesPropertiesQuery({ propertyId: 'prop_1', tab: 'documents' }))
      .toBe('?tab=documents&selected=prop_1&view=list');
  });

  it('το παλιό `unitId` (ADR-269) ⇒ επίσης `selected`', () => {
    expect(legacySpacesPropertiesQuery({ unitId: 'u_9' })).toBe('?selected=u_9&view=list');
  });

  it('ρητή επιλογή/όψη στη διεύθυνση νικά τα ψευδώνυμα — δεν πατιούνται', () => {
    expect(legacySpacesPropertiesQuery({ selected: 'a', propertyId: 'b', view: 'floorplan' }))
      .toBe('?selected=a&view=floorplan');
  });

  it('η δημιουργία (`new=1`) και κάθε άλλο κλειδί ταξιδεύουν αυτούσια, με τη σειρά τους', () => {
    expect(legacySpacesPropertiesQuery({ new: '1', project: ['p1', 'p2'] }))
      .toBe('?new=1&project=p1&project=p2&view=list');
  });
});
