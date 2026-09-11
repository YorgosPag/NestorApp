/**
 * @fileoverview **ΑΓΚΥΡΕΣ: το ακίνητο της διαδρομής ΠΑΡΑΓΕΤΑΙ στο ίδιο καρέ** (ADR-849 Β1 · ADR-777 §8.30).
 * @related hooks/property-viewer-selection · hooks/usePropertiesViewerState
 */

import { resolveViewedProperty } from '../property-viewer-selection';
import type { Property } from '@/types/property-viewer';

const P1 = { id: 'prop_1', name: 'Δ1' } as unknown as Property;
const P2 = { id: 'prop_2', name: 'Δ2', soldTo: 'cont_buyer' } as unknown as Property;

describe('resolveViewedProperty', () => {
  it('Π1 🔴 ρητό id + κατάλογος ⇒ βρέθηκε ΧΩΡΙΣ επιλογή (το καρέ που έλεγε «δεν βρέθηκε»)', () => {
    expect(
      resolveViewedProperty({
        properties: [P1, P2],
        explicitPropertyId: 'prop_1',
        selectedPropertyIds: [],
        contactIds: [],
      }),
    ).toBe(P1);
  });

  it('Π2: η διαδρομή ΝΙΚΑ την επιλογή — ένα κλικ στην κάτοψη δεν αλλάζει θέμα στη σελίδα', () => {
    expect(
      resolveViewedProperty({
        properties: [P1, P2],
        explicitPropertyId: 'prop_1',
        selectedPropertyIds: ['prop_2'],
        contactIds: [],
      }),
    ).toBe(P1);
  });

  it('Π3: χωρίς id (η λίστα) ⇒ μετρά η μοναδική επιλογή, όπως πάντα', () => {
    expect(
      resolveViewedProperty({
        properties: [P1, P2],
        explicitPropertyId: undefined,
        selectedPropertyIds: ['prop_1'],
        contactIds: [],
      }),
    ).toBe(P1);
    expect(
      resolveViewedProperty({
        properties: [P1, P2],
        explicitPropertyId: null,
        selectedPropertyIds: ['prop_1', 'prop_2'],
        contactIds: [],
      }),
    ).toBeNull();
  });

  it('Π4: id που δεν υπάρχει στον κατάλογο ⇒ null (η απουσία κρίνεται μετά την απάντηση του καταλόγου)', () => {
    expect(
      resolveViewedProperty({
        properties: [P1],
        explicitPropertyId: 'prop_missing',
        selectedPropertyIds: [],
        contactIds: [],
      }),
    ).toBeNull();
  });

  it('Π5: ο εμπλουτισμός `buyerMismatch` επιβιώνει', () => {
    expect(
      resolveViewedProperty({
        properties: [P2],
        explicitPropertyId: 'prop_2',
        selectedPropertyIds: [],
        contactIds: ['cont_other'],
      }),
    ).toEqual({ ...P2, buyerMismatch: true });
  });
});
