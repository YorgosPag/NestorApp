/**
 * ⚓ ADR-777 §8.97 — **τα εμβαδά γράφονται μόνο όταν άλλαξαν**, και ο κύκλος ανάγνωση → εγγραφή κλείνει.
 *
 * 🔴 Μετρημένο ζωντανά (2026-10-21, ADR-915 §37.6): η «ΔΟΚΙΜΗ Α» έχει `terrace: 0` στον δίσκο. Αλλαγή ΜΟΝΟ της φάσης ⇒
 *    ο διάλογος επιπτώσεων έδειχνε «Εμβαδά: … Βεράντα 0 τ.μ. → …» — αλλαγή που κανείς δεν έκανε, και που με «Συνέχεια»
 *    θα έσβηνε το πεδίο. Εδώ τρέχει ο **ΑΛΗΘΙΝΟΣ** αναγνώστης (`buildFormDataFromProperty`) πάνω στο ίδιο έγγραφο.
 */

import { buildPropertyUpdatesFromForm } from '../property-fields-form-mapper';
import { buildFormDataFromProperty } from '@/services/property/property-form-sync';
import type { Property } from '@/types/property-viewer';

/** Τα εμβαδά της «ΔΟΚΙΜΗ Α» όπως είναι στη Firestore (ανάγνωση 2026-10-21). */
const DOKIMI_A = {
  id: 'prop_a0000001', name: 'ΔΟΚΙΜΗ Α — Ενοικίαση ΜΕ ενοίκιο', code: 'T-A-1.01', type: 'apartment',
  operationalStatus: 'draft', commercialStatus: 'for-rent', floor: 1,
  layout: { bedrooms: 2, bathrooms: 1, wc: 0 }, orientations: ['south'],
  areas: { gross: 80, net: 72, balcony: 8, terrace: 0 },
  commercial: { askingPrice: null, rentPrice: 500, finalPrice: null },
} as unknown as Property;

const save = (property: Property, edit: (form: ReturnType<typeof buildFormDataFromProperty>) => void = () => undefined) => {
  const formData = buildFormDataFromProperty(property);
  edit(formData);
  return buildPropertyUpdatesFromForm({ formData, property, isMultiLevel: false });
};

describe('Φόρμα ακινήτου → εμβαδά (ADR-777 §8.97)', () => {
  it('🔴 Ε1 — αλλάζει ΜΟΝΟ η φάση ⇒ ΚΑΝΕΝΑ `areas` στο σώμα (το `terrace: 0` δεν είναι αλλαγή)', () => {
    const updates = save(DOKIMI_A, (form) => { form.operationalStatus = 'ready'; });
    expect(updates.operationalStatus).toBe('ready');
    expect(updates).not.toHaveProperty('areas');
  });

  it('Ε2 — αλλάζει ένα εμβαδόν ⇒ ολόκληρο το μπλοκ, χωρίς το `0` («δεν μετρήθηκε»)', () => {
    const updates = save(DOKIMI_A, (form) => { form.areaNet = 70; });
    expect(updates.areas).toEqual({ gross: 80, net: 70, balcony: 8 });
  });

  it('Ε3 — μετρημένο εμβαδόν σβήνεται (→ `0`) ⇒ γράφεται, και το κλειδί λείπει', () => {
    const updates = save(DOKIMI_A, (form) => { form.areaBalcony = 0; });
    expect(updates.areas).toEqual({ gross: 80, net: 72 });
  });

  it('Ε4 — ακίνητο χωρίς `areas` και φόρμα χωρίς εμβαδά ⇒ δεν γεννιέται `{ gross: 0 }`', () => {
    const bare = { ...DOKIMI_A, areas: undefined } as unknown as Property;
    expect(save(bare)).not.toHaveProperty('areas');
  });
});
