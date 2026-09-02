/**
 * @fileoverview ΑΓΚΥΡΑ — **ποιον πίνακα βαρών διαλέγει ένα είδος** (ADR-287 · ADR-842 §8 #3).
 * @related constants/field-completion-weights.ts · constants/property-type-aliases.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟΝ ΜΕΤΑΦΡΑΣΤΗ ΤΗΣ Φ5 — ΤΟ ΜΑΘΗΜΑ ΜΙΑΣ ΜΕΤΑΛΛΑΞΗΣ ΠΟΥ ΔΡΑΠΕΤΕΥΣΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πρώτη γραφή της Φ5 δοκίμασε το §8 #3 **μέσα από** το `listing-completion-slice`.
 * Η μετάλλαξη *«ο πίνακας βαρών παύει να ρωτά την αυθεντία»* βγήκε **πράσινη** — και
 * είχε δίκιο να βγει: ο μεταφραστής στέλνει **ήδη κανονικοποιημένο** είδος, οπότε η
 * γραμμή που δοκιμαζόταν **δεν εκτελούνταν ποτέ** από εκείνη τη διαδρομή.
 *
 * 🔑 Δηλαδή ο φρουρός υπήρχε **χωρίς απόδειξη ζωής** (ADR-749 §5) — ακριβώς το σχήμα
 * που το `ssot:audit --dormant` κυνηγά: *«pattern με 0 ευρήματα είναι καθαρό ή νεκρό,
 * και τα ξεχωρίζει μόνο παράδειγμα εκτελεσμένο στη μηχανή της πύλης»*.
 *
 * ⇒ Η **ζωή** αυτής της γραμμής είναι η **εταιρική** διαδρομή: το
 * `PropertyFieldsFormData.type` έρχεται από **ωμό έγγραφο Firestore** και μπορεί να
 * είναι παλαιά ελληνική τιμή. Άρα η άγκυρα ζει **δίπλα στη γραμμή**, όχι δίπλα στον
 * καταναλωτή που τυχαίνει να μην τη χρειάζεται.
 */

import { PROPERTY_TYPES } from '@/constants/property-types';
import { FIELD_WEIGHTS, getFieldWeightsForType } from '../field-completion-weights';

/** Ο παρονομαστής ενός είδους — το άθροισμα των βαρών του πίνακά του. */
function denominator(type: string | null | undefined): number {
  return getFieldWeightsForType(type).reduce((sum, entry) => sum + entry.weight, 0);
}

describe('Β1 — κάθε κανονικό είδος παίρνει τον ΔΙΚΟ του πίνακα', () => {
  it.each([...PROPERTY_TYPES])('«%s» δείχνει στον πίνακά του', (type) => {
    expect(getFieldWeightsForType(type)).toBe(FIELD_WEIGHTS[type]);
  });

  it('οι παρονομαστές είναι αυτοί που λέει η τεκμηρίωση της Φ5', () => {
    expect(denominator('apartment')).toBe(23);
    expect(denominator('apartment_1br')).toBe(22);
    expect(denominator('studio')).toBe(21.5);
    expect(denominator('shop')).toBe(14);
    expect(denominator('storage')).toBe(9);
  });
});

// ============================================================================
// Β2 — 🔴 ADR-842 §8 #3: ΤΟ «ΣΙΩΠΗΛΑ ΛΑΘΟΣ ΠΑΡΟΝΟΜΑΣΤΗ»
// ============================================================================

describe('Β2 — 🔴 παλαιό/υποβαθμισμένο είδος ΔΕΝ πέφτει σιωπηλά στο διαμέρισμα', () => {
  /**
   * 🔴 **Η ΧΕΙΡΟΤΕΡΗ ΤΩΝ ΤΕΣΣΑΡΩΝ**: μια αποθήκη βαθμολογούνταν με παρονομαστή
   * **23,0** αντί για **9,0** — και της ζητούνταν **υπνοδωμάτια**, ως **κρίσιμα**.
   */
  it('🔴 «Αποθήκη» ⇒ ο πίνακας της αποθήκης (9,0), όχι του διαμερίσματος (23,0)', () => {
    expect(denominator('Αποθήκη')).toBe(9);
    expect(getFieldWeightsForType('Αποθήκη').map((e) => e.key)).not.toContain('bedrooms');
  });

  it('🔴 «Κατάστημα» ⇒ ο πίνακας του καταστήματος (14,0)', () => {
    expect(denominator('Κατάστημα')).toBe(14);
    expect(getFieldWeightsForType('Κατάστημα').map((e) => e.key)).not.toContain('bedrooms');
  });

  /**
   * ⚠️ Εδώ η ζημιά δεν είναι το άθροισμα αλλά η **κρισιμότητα**: το στούντιο ζητά
   * υπνοδωμάτια με βάρος `0,5` **μη κρίσιμο**· ο πίνακας του διαμερίσματος με `2`
   * **κρίσιμο**. Δηλαδή το coaching κατήγγελλε ένα στούντιο ότι «δεν δήλωσε
   * υπνοδωμάτια» — για ακίνητο που εξ ορισμού δεν έχει.
   */
  it('🔴 «Στούντιο» ⇒ υπνοδωμάτια ΜΗ κρίσιμα, βάρος 0,5', () => {
    expect(denominator('Στούντιο')).toBe(21.5);
    const bedrooms = getFieldWeightsForType('Στούντιο').find((e) => e.key === 'bedrooms');
    expect(bedrooms).toEqual({ key: 'bedrooms', weight: 0.5, critical: false });
  });

  it('«Γκαρσονιέρα» ⇒ ο πίνακας του `apartment_1br` (22,0)', () => {
    expect(denominator('Γκαρσονιέρα')).toBe(22);
  });

  it('οι `@deprecated` παραλλαγές καταρρέουν στην οικογένεια του διαμερίσματος', () => {
    expect(getFieldWeightsForType('apartment_2br')).toBe(FIELD_WEIGHTS.apartment);
    expect(getFieldWeightsForType('apartment_3br')).toBe(FIELD_WEIGHTS.apartment);
  });

  it('παλαιό αγγλικό συνώνυμο («store») φτάνει στο κατάστημα', () => {
    expect(getFieldWeightsForType('store')).toBe(FIELD_WEIGHTS.shop);
  });
});

describe('Β3 — η προεπιλογή είναι ΣΥΝΤΗΡΗΤΙΚΗ, όχι σιωπηλή', () => {
  it.each([null, undefined, '', '   ', 'κάτι τυχαίο'])(
    '%p ⇒ ο πίνακας του διαμερίσματος',
    (input) => {
      expect(getFieldWeightsForType(input as string | null | undefined)).toBe(
        FIELD_WEIGHTS.apartment,
      );
    },
  );
});
