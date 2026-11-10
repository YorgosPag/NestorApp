/**
 * ⚓ ADR-777 §8.97 · ADR-249 §7.7 — **τα εμβαδά γράφονται μόνο όταν άλλαξαν**, και ο κύκλος ανάγνωση → εγγραφή κλείνει.
 *
 * 🔴 Μετρημένο ζωντανά (2026-10-21, ADR-915 §37.6): η «ΔΟΚΙΜΗ Α» έχει `terrace: 0` στον δίσκο. Αλλαγή ΜΟΝΟ της φάσης ⇒
 *    ο διάλογος επιπτώσεων έδειχνε «Εμβαδά: … Βεράντα 0 τ.μ. → …» — αλλαγή που κανείς δεν έκανε, και που με «Συνέχεια»
 *    θα έσβηνε το πεδίο. Εδώ τρέχει ο **ΑΛΗΘΙΝΟΣ** αναγνώστης (`buildFormDataFromProperty`) πάνω στο ίδιο έγγραφο.
 *
 * 🔑 Από το ADR-249 §7 το «μόνο ό,τι άλλαξε» **δεν** ζει στον mapper: ο `buildPropertyUpdatesFromForm` δίνει την
 *    **πλήρη** εικόνα (τη χρειάζεται η δημιουργία) και το ΕΝΑ φίλτρο `changedPropertyUpdatesFromForm` κρίνει τι φεύγει.
 *    Τα tests κρίνουν λοιπόν **ό,τι στέλνει η φόρμα** — τον ίδιο δρόμο με το `PropertyFieldsBlock`.
 */

import { buildPropertyUpdatesFromForm, changedPropertyUpdatesFromForm } from '../property-fields-form-mapper';
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

type Form = ReturnType<typeof buildFormDataFromProperty>;

/** Η φόρμα όπως φορτώνεται, η επεξεργασία του ανθρώπου, και ό,τι φεύγει στο δίκτυο. */
const save = (property: Property, edit: (form: Form) => void = () => undefined) => {
  const formData = buildFormDataFromProperty(property);
  edit(formData);
  const updates = buildPropertyUpdatesFromForm({ formData, property, isMultiLevel: false });
  return changedPropertyUpdatesFromForm({ updates, property, isMultiLevel: false });
};

const clearAll = (form: Form) => {
  form.areaGross = 0; form.areaNet = 0; form.areaBalcony = 0; form.areaTerrace = 0; form.areaGarden = 0;
};

describe('Φόρμα ακινήτου → εμβαδά (ADR-777 §8.97 · ADR-249 §7)', () => {
  it('🔴 Ε1 — αλλάζει ΜΟΝΟ η φάση ⇒ ΚΑΝΕΝΑ `areas` στο σώμα (το `terrace: 0` δεν είναι αλλαγή)', () => {
    expect(save(DOKIMI_A, (form) => { form.operationalStatus = 'ready'; })).toEqual({ operationalStatus: 'ready' });
  });

  it('Ε2 — αλλάζει ένα εμβαδόν ⇒ ολόκληρο το μπλοκ, χωρίς το `0` («δεν μετρήθηκε»)', () => {
    expect(save(DOKIMI_A, (form) => { form.areaNet = 70; }).areas).toEqual({ gross: 80, net: 70, balcony: 8 });
  });

  it('Ε3 — μετρημένο εμβαδόν σβήνεται (→ `0`) ⇒ γράφεται, και το κλειδί λείπει', () => {
    expect(save(DOKIMI_A, (form) => { form.areaBalcony = 0; }).areas).toEqual({ gross: 80, net: 72 });
  });

  it('Ε4 — ακίνητο χωρίς `areas` και φόρμα χωρίς εμβαδά ⇒ δεν γεννιέται `{ gross: 0 }`', () => {
    const bare = { ...DOKIMI_A, areas: undefined } as unknown as Property;
    expect(save(bare)).not.toHaveProperty('areas');
  });

  it('🔴 Ε5 — ΟΛΑ τα εμβαδά αδειάζουν ⇒ `areas: null` (RFC 7396 «σβήσε»· ο server το κάνει διαγραφή, ADR-249 §7.8–§7.9)', () => {
    expect(save(DOKIMI_A, clearAll)).toEqual({ areas: null });
  });

  it('Ε6 — καμία αλλαγή ⇒ κενό σώμα (καμία εγγραφή, καμία γραμμή ιστορικού)', () => {
    expect(save(DOKIMI_A)).toEqual({});
  });

  it('Ε7 — η ΔΗΜΙΟΥΡΓΙΑ παίρνει την πλήρη εικόνα: ο mapper μόνος του ΔΕΝ φιλτράρει το αμετάβλητο', () => {
    const updates = buildPropertyUpdatesFromForm({
      formData: buildFormDataFromProperty(DOKIMI_A),
      property: DOKIMI_A,
      isMultiLevel: false,
    });
    expect(updates.areas).toEqual({ gross: 80, net: 72, balcony: 8 });
  });
});
