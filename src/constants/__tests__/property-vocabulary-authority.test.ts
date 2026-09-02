/**
 * **Η ΑΓΚΥΡΑ ΤΗΣ ΑΡΧΗΣ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ** — ADR-842 Α4.
 *
 * Ερώτημα: *«απαριθμεί κάποιος το λεξιλόγιο των χαρακτηριστικών **δεύτερη φορά**;»*
 *
 * 🔴 **Γιατί υπάρχει.** Μέχρι τις 2026-09-02 το λεξιλόγιο ζούσε σε **δύο** τόπους: το
 * `constants/property-features-enterprise.ts` το δήλωνε ως τύπους ένωσης, και το
 * `features/property-details/components/property-fields-constants.ts` το **ξαναέγραφε
 * με το χέρι** ως πίνακες για τα dropdowns.
 *
 * ⚠️ **Και οι δύο συμφωνούσαν — μετρήθηκε, 10 στα 10.** Η διόρθωση δεν έγινε επειδή
 * κάτι έσπασε· έγινε επειδή **δεν μπορούσε να σπάσει θορυβωδώς**: ο τύπος `XType[]`
 * δέχεται **υποσύνολο**, άρα μια τιμή που προστίθεται στο λεξιλόγιο **δεν φτάνει ποτέ
 * στο dropdown** χωρίς κανένα σφάλμα μεταγλώττισης. Ο χρήστης απλώς δεν βλέπει την
 * επιλογή, και κανείς δεν το μαθαίνει.
 *
 * 🔑 **Τι φυλάει σήμερα.** Η απόκλιση είναι πλέον **δομικά αδύνατη** (ο τύπος
 * παράγεται από τη λίστα). Αυτή η άγκυρα φυλάει την **παλινδρόμηση**: αν κάποιος
 * ξαναγράψει χειρόγραφο πίνακα στη θέση της όψης, κοκκινίζει εδώ.
 *
 * ⚠️ **ΜΗΝ «απλοποιήσεις» συγκρίνοντας μόνο μήκη.** Δύο λίστες ίδιου μήκους με
 * διαφορετικές τιμές είναι ακριβώς η αστοχία που ψάχνουμε.
 *
 * @see ADR-842 §5 Α4 · docs/centralized-systems/reference/adrs/ADR-842-property-attributes-and-provenance.md
 */

import {
  ORIENTATIONS,
  ENERGY_CLASSES,
  INTERIOR_FEATURES,
  SECURITY_FEATURES,
  AMENITIES,
  VIEW_TYPES,
  CONDITIONS,
  HEATING_TYPES,
  FUEL_TYPES,
  COOLING_TYPES,
  WATER_HEATING_TYPES,
  FLOORINGS,
  FRAMES,
  GLAZINGS,
  BUILDING_FORMS,
  VIEW_QUALITIES,
} from '@/constants/property-features-enterprise';
import {
  ORIENTATION_OPTIONS,
  ENERGY_CLASS_OPTIONS,
  INTERIOR_FEATURE_OPTIONS,
  SECURITY_FEATURE_OPTIONS,
  CONDITION_OPTIONS,
  HEATING_OPTIONS,
  COOLING_OPTIONS,
  FLOORING_OPTIONS,
  FRAME_OPTIONS,
  GLAZING_OPTIONS,
} from '@/features/property-details/components/property-fields-constants';

/** Κάθε λεξιλόγιο του τομέα, με το όνομά του για αναγνώσιμη αποτυχία. */
const VOCABULARIES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['ORIENTATIONS', ORIENTATIONS],
  ['ENERGY_CLASSES', ENERGY_CLASSES],
  ['INTERIOR_FEATURES', INTERIOR_FEATURES],
  ['SECURITY_FEATURES', SECURITY_FEATURES],
  ['AMENITIES', AMENITIES],
  ['VIEW_TYPES', VIEW_TYPES],
  ['CONDITIONS', CONDITIONS],
  ['HEATING_TYPES', HEATING_TYPES],
  ['FUEL_TYPES', FUEL_TYPES],
  ['COOLING_TYPES', COOLING_TYPES],
  ['WATER_HEATING_TYPES', WATER_HEATING_TYPES],
  ['FLOORINGS', FLOORINGS],
  ['FRAMES', FRAMES],
  ['GLAZINGS', GLAZINGS],
  ['BUILDING_FORMS', BUILDING_FORMS],
  ['VIEW_QUALITIES', VIEW_QUALITIES],
];

/**
 * Κάθε όψη που ζωγραφίζει dropdown, δεμένη στην **αυθεντία** της.
 *
 * 🔑 Η σύγκριση είναι **κατά σειρά** (`toEqual` σε πίνακες), όχι κατά σύνολο: η σειρά
 * του λεξιλογίου **είναι** η σειρά της οθόνης, όπως και στο `LISTING_DISCLOSURE`.
 */
const VIEWS: ReadonlyArray<readonly [string, readonly string[], readonly string[]]> = [
  ['ORIENTATION_OPTIONS', ORIENTATION_OPTIONS, ORIENTATIONS],
  ['ENERGY_CLASS_OPTIONS', ENERGY_CLASS_OPTIONS, ENERGY_CLASSES],
  ['INTERIOR_FEATURE_OPTIONS', INTERIOR_FEATURE_OPTIONS, INTERIOR_FEATURES],
  ['SECURITY_FEATURE_OPTIONS', SECURITY_FEATURE_OPTIONS, SECURITY_FEATURES],
  ['CONDITION_OPTIONS', CONDITION_OPTIONS, CONDITIONS],
  ['HEATING_OPTIONS', HEATING_OPTIONS, HEATING_TYPES],
  ['COOLING_OPTIONS', COOLING_OPTIONS, COOLING_TYPES],
  ['FLOORING_OPTIONS', FLOORING_OPTIONS, FLOORINGS],
  ['FRAME_OPTIONS', FRAME_OPTIONS, FRAMES],
  ['GLAZING_OPTIONS', GLAZING_OPTIONS, GLAZINGS],
];

describe('ADR-842 Α4 · η αρχή του λεξιλογίου χαρακτηριστικών', () => {
  describe('κάθε λεξιλόγιο είναι υπαρκτό και χωρίς επαναλήψεις', () => {
    it.each(VOCABULARIES)('%s δεν είναι κενό', (_name, values) => {
      expect(values.length).toBeGreaterThan(0);
    });

    it.each(VOCABULARIES)('%s δεν έχει διπλότυπη τιμή', (_name, values) => {
      expect([...new Set(values)]).toHaveLength(values.length);
    });

    it.each(VOCABULARIES)('%s δεν έχει κενή ή με κενά τιμή', (_name, values) => {
      for (const value of values) {
        expect(value).toBe(value.trim());
        expect(value).not.toBe('');
      }
    });
  });

  describe('🔴 καμία όψη δεν ξαναγράφει το λεξιλόγιο', () => {
    it.each(VIEWS)(
      '%s είναι ΑΚΡΙΒΩΣ η αυθεντία του — ίδιες τιμές, ίδια σειρά',
      (_name, view, authority) => {
        expect(view).toEqual([...authority]);
      },
    );

    it.each(VIEWS)('%s δεν χάνει καμία τιμή του λεξιλογίου', (_name, view, authority) => {
      for (const value of authority) {
        expect(view).toContain(value);
      }
    });

    it.each(VIEWS)('%s δεν εφευρίσκει τιμή εκτός λεξιλογίου', (_name, view, authority) => {
      for (const value of view) {
        expect(authority).toContain(value);
      }
    });
  });

  describe('🔴 η όψη είναι ΑΝΤΙΓΡΑΦΟ, ποτέ η ίδια αναφορά', () => {
    /**
     * Το `Object.values()` τρέχει **μία φορά** ανά module, άρα υπάρχει **ένας** πίνακας
     * λεξιλογίου. Όψη που τον μοιράζεται με αναφορά μετατρέπει κάθε `.sort()` ή
     * `.push()` ενός dropdown σε **μετάλλαξη της SSoT** για ολόκληρη την εφαρμογή, με
     * την αιτία αόρατη στο σημείο του σφάλματος.
     */
    it.each(VIEWS)('%s δεν είναι η ίδια αναφορά με την αυθεντία', (_name, view, authority) => {
      expect(view).not.toBe(authority);
    });

    // ⚠️ Κανένα test εδώ δεν **εκτελεί** τη μετάλλαξη: θα άφηνε βρώμικο module state για
    //    τα υπόλοιπα. Η ταυτότητα αναφοράς είναι το παρατηρήσιμο· το `readonly` στην
    //    αυθεντία κάνει τη μετάλλαξη σφάλμα **μεταγλώττισης**, όχι σφάλμα χρόνου εκτέλεσης.
  });

  describe('η ενεργειακή κλίμακα διατηρεί τη ΣΕΙΡΑ ΤΗΣ, όχι αλφαβητική', () => {
    it('ξεκινά από A+ και τελειώνει στο G', () => {
      // ⚠️ Αλφαβητική ταξινόμηση θα έβαζε το 'A' πριν το 'A+' και θα άλλαζε την οθόνη
      //    χωρίς να αλλάξει καμία τιμή — αστοχία αόρατη σε έλεγχο συνόλου.
      expect(ENERGY_CLASSES[0]).toBe('A+');
      expect(ENERGY_CLASSES[ENERGY_CLASSES.length - 1]).toBe('G');
    });
  });
});
