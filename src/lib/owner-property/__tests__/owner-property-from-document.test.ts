/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΤΟΥ ΙΔΙΩΤΗ, ΕΚΤΕΛΕΣΜΕΝΟ** — ADR-842 §7.6.12 / §8 #11.
 * @related lib/owner-property/owner-property-from-document.ts · ADR-839
 *
 * 🔴 **ΤΙ ΚΡΙΝΕΤΑΙ ΕΔΩ, ΚΑΙ ΤΙ ΟΧΙ.** Δεν κρίνεται ότι *«ο `normalizePropertyType`
 * δουλεύει»* — αυτό το φυλάει η δική του άγκυρα (`property-type-classes.test.ts`).
 * Κρίνεται ότι **το σύνορο τον καλεί**, ότι η **ταυτότητα του εγγράφου νικά**, ότι τα
 * υπάρχοντα φύλλα (`mediaOf` / `mandatesOf`) εφαρμόζονται **εδώ αντί για παντού**, και
 * ότι το «δεν ξέρω» φτάνει στον καταναλωτή **με όνομα** αντί για προεπιλογή.
 *
 * ⚠️ **Κάθε σκέλος μεταλλάχθηκε.** Ένα σκέλος που μένει πράσινο με το ελάττωμα
 * ζωντανό δεν είναι άγκυρα — είναι εμφάνιση (§7.6.11: το `'Αποθήκη'` έμοιαζε με
 * απόδειξη επί μέρες).
 */

import {
  DEPRECATED_PROPERTY_TYPES,
  LEGACY_GREEK_PROPERTY_TYPES,
  PROPERTY_TYPES,
} from '@/constants/property-types';
import {
  ownerPropertyFromDocument,
  readStoredOwnerProperty,
} from '@/lib/owner-property/owner-property-from-document';

import { validOwnerProperty, SAMPLE_MEDIA } from './owner-property-fixtures';

/** Ό,τι θα γύριζε η Firestore: το έγγραφο **χωρίς** την ταυτότητά του. */
function storedDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const { id: _ignored, ...body } = validOwnerProperty();
  return { ...body, ...overrides };
}

describe('Κ1 — το σύνορο ΚΑΛΕΙ τον κανονικοποιητή', () => {
  it('κρατά αυτούσια κάθε κανονική τιμή (ιδιοδυναμία)', () => {
    for (const type of PROPERTY_TYPES) {
      const read = readStoredOwnerProperty(storedDoc({ type }), 'ownp_a');
      expect(read?.property.type).toBe(type);
      expect(read?.vocabularyDrift).toBeNull();
    }
  });

  it('μεταφράζει ΚΑΘΕ τιμή του κλειστού ιστορικού λεξιλογίου', () => {
    // 🔑 Ο πίνακας **εκτελείται**, δεν αντιγράφεται: αν κάποιος προσθέσει παλαιά τιμή
    //    χωρίς ψευδώνυμο, αυτό κοκκινίζει — δεν πάλιωνει σιωπηλά.
    for (const legacy of [...LEGACY_GREEK_PROPERTY_TYPES, ...DEPRECATED_PROPERTY_TYPES]) {
      const read = readStoredOwnerProperty(storedDoc({ type: legacy }), 'ownp_a');
      expect(read).not.toBeNull();
      expect(read?.property.type).not.toBeNull();
      expect(PROPERTY_TYPES).toContain(read?.property.type);
      expect(read?.vocabularyDrift).toBe(legacy);
    }
  });

  it('🔴 ΠΙΑΝΕΙ ΤΟ ΚΑΝΑΛΙ ΠΟΥ Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ ΔΕΝ ΕΒΛΕΠΕ ΠΟΤΕ: γη με ελληνικό όνομα', () => {
    // Το `'Οικόπεδο'`/`'Αγροτεμάχιο'` **δεν ήταν ποτέ** στην ένωση `PropertyType`
    // (η γη μπήκε 2026-08-20, μετά το πάγωμα της παλαιάς λίστας) — έφταναν
    // αποκλειστικά από τα 19 ωμά `as OwnerProperty`.
    expect(readStoredOwnerProperty(storedDoc({ type: 'Οικόπεδο' }), 'ownp_a')?.property.type).toBe(
      'plot',
    );
    expect(
      readStoredOwnerProperty(storedDoc({ type: 'Αγροτεμάχιο' }), 'ownp_a')?.property.type,
    ).toBe('parcel');
  });

  it('δέχεται κενά και κεφαλαία, όπως ο κανονικοποιητής', () => {
    expect(readStoredOwnerProperty(storedDoc({ type: '  STORE  ' }), 'ownp_a')?.property.type).toBe(
      'shop',
    );
  });
});

describe('Κ2 — το «δεν ξέρω» έχει ΟΝΟΜΑ, ποτέ προεπιλογή', () => {
  it('αγνώριστη τιμή ⇒ null, ΚΑΙ ολίσθηση με την ωμή τιμή', () => {
    const read = readStoredOwnerProperty(storedDoc({ type: 'parking' }), 'ownp_a');
    expect(read?.property.type).toBeNull();
    expect(read?.vocabularyDrift).toBe('parking');
    // 🔴 Η μετάλλαξη που πιάνει την επιστροφή του ελαττώματος:
    expect(read?.property.type).not.toBe('apartment');
  });

  it('απόν `type` ⇒ null ΧΩΡΙΣ ολίσθηση — απουσία ≠ ολίσθηση', () => {
    const { type: _dropped, ...withoutType } = storedDoc();
    const read = readStoredOwnerProperty(withoutType, 'ownp_a');
    expect(read?.property.type).toBeNull();
    expect(read?.vocabularyDrift).toBeNull();
  });

  it('μη-συμβολοσειρά ⇒ null, και η ολίσθηση την αναφέρει', () => {
    const read = readStoredOwnerProperty(storedDoc({ type: 42 }), 'ownp_a');
    expect(read?.property.type).toBeNull();
    expect(read?.vocabularyDrift).toBe('42');
  });
});

describe('Κ3 — η ταυτότητα έρχεται ΑΠΟ ΕΞΩ και νικά', () => {
  it('το `id` του εγγράφου υπερισχύει ενός `id` γραμμένου μέσα στο περιεχόμενο', () => {
    const read = readStoredOwnerProperty(
      storedDoc({ id: 'ownp_ΑΝΤΙΓΡΑΦΟ_ΠΟΥ_ΑΠΕΚΛΙΝΕ' }),
      'ownp_πραγματικό',
    );
    expect(read?.property.id).toBe('ownp_πραγματικό');
  });
});

describe('Κ4 — τα ΥΠΑΡΧΟΝΤΑ φύλλα εφαρμόζονται ΕΔΩ, αντί για παντού', () => {
  it('έγγραφο χωρίς `media` δίνει κενό πίνακα (δεν ρίχνει τον καταναλωτή)', () => {
    const { media: _dropped, ...withoutMedia } = storedDoc();
    const property = ownerPropertyFromDocument(withoutMedia, 'ownp_a');
    expect(property?.media).toEqual([]);
    // Χωρίς αυτό, το `publishedOwnerMedia` πετά
    // `TypeError: Cannot read properties of undefined (reading 'filter')`.
    expect(() => property?.media.filter(Boolean)).not.toThrow();
  });

  it('υπαρκτό `media` περνά ΑΥΤΟΥΣΙΟ', () => {
    const property = ownerPropertyFromDocument(storedDoc({ media: [SAMPLE_MEDIA] }), 'ownp_a');
    expect(property?.media).toEqual([SAMPLE_MEDIA]);
  });

  it('παλαιό ενικό `mandate: { kind: "self" }` γίνεται ΚΕΝΟΣ πίνακας', () => {
    const { mandates: _dropped, ...legacyShape } = storedDoc();
    const property = ownerPropertyFromDocument(
      { ...legacyShape, mandate: { kind: 'self' } },
      'ownp_a',
    );
    expect(property?.mandates).toEqual([]);
    expect(() => property?.mandates.length).not.toThrow();
  });
});

describe('Κ5 — τι σημαίνει `null` από το ίδιο το σύνορο', () => {
  it('`null` ΜΟΝΟ όταν τα δεδομένα δεν είναι καν αντικείμενο', () => {
    expect(readStoredOwnerProperty(null, 'ownp_a')).toBeNull();
    expect(readStoredOwnerProperty(undefined, 'ownp_a')).toBeNull();
    expect(readStoredOwnerProperty('κείμενο', 'ownp_a')).toBeNull();
    expect(readStoredOwnerProperty([1, 2, 3], 'ownp_a')).toBeNull();
  });

  it('🔴 ΔΕΝ επιστρέφεται `null` για ελλιπές ή αγνώριστο πεδίο — το ακίνητο ΖΕΙ', () => {
    // Ίδιο συμβόλαιο με το ADR-839: ένα ακίνητο που έχασε ένα πεδίο εξακολουθεί να
    // είναι ακίνητο, και ο κάτοχός του δικαιούται να το δει και να το διορθώσει.
    expect(readStoredOwnerProperty(storedDoc({ type: 'parking' }), 'ownp_a')).not.toBeNull();
    expect(readStoredOwnerProperty({}, 'ownp_a')).not.toBeNull();
  });
});

describe('Κ6 — ιδιοδυναμία: δεύτερη διέλευση δίνει το ίδιο', () => {
  it('περνώντας το αποτέλεσμα ξανά από το σύνορο, τίποτα δεν αλλάζει', () => {
    const first = ownerPropertyFromDocument(storedDoc({ type: 'Μεζονέτα' }), 'ownp_a');
    const second = ownerPropertyFromDocument(first, 'ownp_a');
    expect(second).toEqual(first);
    expect(second?.type).toBe('maisonette');
  });
});
