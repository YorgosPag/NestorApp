/**
 * @fileoverview **Ο ΔΕΥΤΕΡΟΣ ΑΞΟΝΑΣ** — άγκυρες για την κατηγορία ειδών ακινήτου.
 * @related ADR-777 §8.32 · constants/property-types.ts · constants/property-type-aliases.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΚΑΘΕ ΑΓΚΥΡΑ ΕΧΕΙ ΟΝΟΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η προσθήκη της γης δεν ήταν «δύο τιμές σε έναν πίνακα». Ήταν η αντικατάσταση
 * ενός **συμπληρώματος** («κατοικία = ό,τι δεν είναι εμπορικό») με **ρητή
 * ανάθεση**. Το συμπλήρωμα δίνει κατηγορία σε τιμές **που κανείς δεν εξέτασε** —
 * και συγκεκριμένα θα είχε βαφτίσει το **οικόπεδο «κατοικία»**.
 *
 * Οι άγκυρες εδώ κρατούν **πέντε** πράγματα που ο μεταγλωττιστής **δεν** μπορεί:
 * ότι τα παραγόμενα σύνολα δεν ξαναγίνονται χειρόγραφα· ότι η γη δεν διαρρέει σε
 * dropdown δημιουργίας μονάδας· ότι ο **χειρόγραφος καθρέφτης** των ελληνικών
 * ετικετών δεν ξανα-αποκλίνει (είχε **ήδη** αποκλίνει: `loft` = «Loft» ενώ το
 * locale έλεγε «Σοφίτα»)· ότι κάθε είδος **αναγνωρίζει τον εαυτό του**· και ότι
 * κάθε είδος έχει κείμενο **και στις δύο** γλώσσες (N.11).
 */

import elEnums from '@/i18n/locales/el/properties-enums.json';
import enEnums from '@/i18n/locales/en/properties-enums.json';
import {
  COMMERCIAL_PROPERTY_TYPES,
  CREATABLE_PROPERTY_TYPES,
  isLandPropertyType,
  LAND_PROPERTY_TYPES,
  PROPERTY_CLASSES,
  PROPERTY_TYPE_CLASS,
  PROPERTY_TYPE_I18N_KEYS,
  PROPERTY_TYPES,
  propertyClassOf,
  propertyTypesOfClass,
  RESIDENTIAL_PROPERTY_TYPES,
  type PropertyClass,
} from '@/constants/property-types';
import {
  getPropertyTypeLabelEL,
  normalizePropertyType,
  PROPERTY_TYPE_LABELS_EL,
  propertyTypesMissingSelfAlias,
} from '@/constants/property-type-aliases';
import { UNIT_TYPES_FOR_FILTER } from '@/components/building-management/tabs/property-tab-constants';

/** Οι ελληνικές/αγγλικές ετικέτες, όπως τις βλέπει η οθόνη. */
const EL_TYPES = (elEnums as { types: Record<string, string> }).types;
const EN_TYPES = (enEnums as { types: Record<string, string> }).types;

/** Το τμήμα του i18n κλειδιού μετά το `types.` — η μορφή είναι συμβόλαιο (Κ7). */
function leafOf(key: string): string {
  return key.replace(/^types\./, '');
}

describe('ADR-777 §8.32 — Ο δεύτερος άξονας: η κατηγορία του είδους', () => {
  // ==========================================================================
  // Α. Η ΑΝΑΘΕΣΗ ΕΙΝΑΙ ΡΗΤΗ ΚΑΙ ΠΛΗΡΗΣ
  // ==========================================================================

  it('Κ1 — ΚΑΘΕ είδος έχει κατηγορία, και η κατηγορία είναι γνωστή τιμή', () => {
    // Ο μεταγλωττιστής εγγυάται την πληρότητα του `Record`· εδώ κρατάμε ότι καμία
    // **τιμή** δεν ξέφυγε από το κλειστό σύνολο, κάτι που ένα `as` θα επέτρεπε.
    for (const type of PROPERTY_TYPES) {
      const klass = PROPERTY_TYPE_CLASS[type];
      expect(PROPERTY_CLASSES).toContain(klass);
    }
    expect(Object.keys(PROPERTY_TYPE_CLASS).sort()).toEqual([...PROPERTY_TYPES].sort());
  });

  it('Κ2 — η γη είναι ακριβώς `plot` + `parcel`, και το κατηγόρημα συμφωνεί', () => {
    expect(LAND_PROPERTY_TYPES).toEqual(['plot', 'parcel']);
    expect(isLandPropertyType('plot')).toBe(true);
    expect(isLandPropertyType('parcel')).toBe(true);
    expect(isLandPropertyType('apartment')).toBe(false);
    expect(isLandPropertyType('storage')).toBe(false);
    // Άγνωστη είσοδος ⇒ **όχι γη**, ποτέ σφάλμα: τα έγγραφα Firestore κουβαλούν
    // ακόμη παλιές ελληνικές τιμές.
    expect(isLandPropertyType('Αποθήκη')).toBe(false);
    expect(isLandPropertyType(undefined)).toBe(false);
    expect(propertyClassOf('κάτι τυχαίο')).toBeNull();
  });

  it('🔴 Κ3 — ΤΟ ΣΥΜΠΛΗΡΩΜΑ ΔΕΝ ΕΠΙΣΤΡΕΦΕΙ: καμία γη μέσα στην «κατοικία»', () => {
    // Αυτή είναι η άγκυρα του ίδιου του ελαττώματος. Με τον παλιό ορισμό
    // (`RESIDENTIAL = PROPERTY_TYPES \ COMMERCIAL`) και τα δύο θα ήταν εδώ μέσα,
    // και ο κανόνας του υπογείου θα ρωτούσε αν είναι περίεργο ένα οικόπεδο στο -1.
    for (const land of LAND_PROPERTY_TYPES) {
      expect(RESIDENTIAL_PROPERTY_TYPES).not.toContain(land);
      expect(COMMERCIAL_PROPERTY_TYPES).not.toContain(land);
    }
    // Και τα τρία σύνολα μαζί = όλα τα είδη, χωρίς επικάλυψη (κλειστή λογιστική).
    const union = [
      ...propertyTypesOfClass('land'),
      ...propertyTypesOfClass('residential'),
      ...propertyTypesOfClass('commercial'),
    ];
    expect(union.sort()).toEqual([...PROPERTY_TYPES].sort());
    expect(new Set(union).size).toBe(PROPERTY_TYPES.length);
  });

  it('Κ4 — τα παραγόμενα σύνολα κρατούν τη σειρά εμφάνισης του πίνακα', () => {
    // Ένα dropdown φιλτραρισμένο κατά κατηγορία δεν επιτρέπεται να δείχνει άλλη
    // σειρά από το πλήρες: η σειρά **είναι** διεπαφή.
    for (const klass of PROPERTY_CLASSES) {
      const subset = propertyTypesOfClass(klass);
      const expected = PROPERTY_TYPES.filter((t) => subset.includes(t));
      expect(subset).toEqual(expected);
    }
  });

  // ==========================================================================
  // Β. Η ΓΗ ΔΕΝ ΔΙΑΡΡΕΕΙ ΕΚΕΙ ΠΟΥ ΔΕΝ ΑΝΗΚΕΙ
  // ==========================================================================

  it('🔴 Κ5 — καμία γη στα dropdowns δημιουργίας ΜΟΝΑΔΑΣ', () => {
    // Το `CREATABLE_PROPERTY_TYPES` τροφοδοτεί «νέα μονάδα σε έργο/κτίριο/όροφο».
    // Ένα οικόπεδο δεν είναι όροφος πολυκατοικίας.
    for (const land of LAND_PROPERTY_TYPES) {
      expect(CREATABLE_PROPERTY_TYPES).not.toContain(land);
    }
    expect(CREATABLE_PROPERTY_TYPES).not.toContain('storage');
    expect(CREATABLE_PROPERTY_TYPES).toContain('apartment');
  });

  it('🔴 Κ5β — καμία γη στο φίλτρο μονάδων ΕΝΟΣ ΚΤΙΡΙΟΥ (…αλλά η αποθήκη μένει)', () => {
    // Ένα κτίριο δεν περιέχει οικόπεδα — η σχέση είναι αντίστροφη. Δύο επιλογές που
    // δεν μπορούν ποτέ να δώσουν αποτέλεσμα είναι φίλτρο χωρίς απόδειξη ζωής.
    for (const land of LAND_PROPERTY_TYPES) {
      expect(UNIT_TYPES_FOR_FILTER).not.toContain(land);
    }
    // ⚠️ Ο παρονομαστής που ξεχωρίζει αυτό το φίλτρο από το `CREATABLE`: οι αποθήκες
    // **υπάρχουν** μέσα σε κτίριο, απλώς δημιουργούνται αλλού. Μια «απλοποίηση» σε
    // `CREATABLE_PROPERTY_TYPES` θα τις έκρυβε από το φίλτρο, σιωπηλά.
    expect(UNIT_TYPES_FOR_FILTER).toContain('storage');
  });

  it('🔴 Κ6 — Η ΓΗ ΥΠΑΡΧΕΙ στον πλήρη πίνακα, που είναι ό,τι βλέπει ο ιδιοκτήτης', () => {
    // Ο παρονομαστής του Κ5: αν κάποιος «λύσει» το Κ5 βγάζοντας τη γη από το
    // `PROPERTY_TYPES`, η φόρμα της προσφοράς (`OwnerPropertyFields`, που διαβάζει
    // το πλήρες) θα έχανε σιωπηλά το μόνο είδος που σηκώνει αντιπαροχή.
    expect(PROPERTY_TYPES).toContain('plot');
    expect(PROPERTY_TYPES).toContain('parcel');
  });

  // ==========================================================================
  // Γ. ΤΑ ΚΕΙΜΕΝΑ — δύο γλώσσες, ένας καθρέφτης
  // ==========================================================================

  it('Κ7 — κάθε είδος έχει i18n κλειδί, και το κλειδί υπάρχει σε el ΚΑΙ en (N.11)', () => {
    for (const type of PROPERTY_TYPES) {
      const key = PROPERTY_TYPE_I18N_KEYS[type];
      expect(key).toBe(`types.${type}`);
      expect(EL_TYPES[leafOf(key)]).toBeTruthy();
      expect(EN_TYPES[leafOf(key)]).toBeTruthy();
    }
  });

  it('🔴 Κ8 — Ο ΧΕΙΡΟΓΡΑΦΟΣ ΚΑΘΡΕΦΤΗΣ ΣΥΜΦΩΝΕΙ ΜΕ ΤΟ LOCALE (είχε ήδη αποκλίνει)', () => {
    // 2026-08-20: ο πίνακας έλεγε `loft: 'Loft'` ενώ το locale έλεγε «Σοφίτα» —
    // μία απόκλιση στις δώδεκα, σε αρχείο που ζητούσε από **άνθρωπο** συντήρηση.
    // Οδηγία σε σχόλιο δεν είναι πύλη· αυτή η άγκυρα είναι.
    const drift: string[] = [];
    for (const type of PROPERTY_TYPES) {
      if (PROPERTY_TYPE_LABELS_EL[type] !== EL_TYPES[type]) {
        drift.push(`${type}: TS='${PROPERTY_TYPE_LABELS_EL[type]}' locale='${EL_TYPES[type]}'`);
      }
    }
    expect(drift).toEqual([]);
  });

  it('🔴 Κ9 — κάθε είδος ΑΝΑΓΝΩΡΙΖΕΙ ΤΟΝ ΕΑΥΤΟ ΤΟΥ στον πίνακα αναγνώρισης', () => {
    // Χωρίς αυτό, ένα νέο είδος περνά ολόκληρη την εφαρμογή και σκοντάφτει **μόνο**
    // στην πύλη γραφής (`property-mutation-gateway`), που θα το έλεγε «άγνωστο».
    expect(propertyTypesMissingSelfAlias()).toEqual([]);
  });

  it('Κ10 — τα ελληνικά ονόματα της γης λύνονται σε είδος γης', () => {
    expect(normalizePropertyType('Οικόπεδο')).toBe('plot');
    expect(normalizePropertyType('  οικοπεδο ')).toBe('plot');
    expect(normalizePropertyType('αγροτεμάχιο')).toBe('parcel');
    expect(normalizePropertyType('χωράφι')).toBe('parcel');
    expect(getPropertyTypeLabelEL('plot')).toBe('Οικόπεδο');
    expect(getPropertyTypeLabelEL('parcel')).toBe('Αγροτεμάχιο');
    // ⚠️ Η γη ΔΕΝ έχει οικογένεια: «οικόπεδο» δεν ταιριάζει με «αγροτεμάχιο».
    expect(normalizePropertyType('οικόπεδο')).not.toBe(normalizePropertyType('χωράφι'));
  });

  it('Κ11 — η διορθωμένη «Σοφίτα» αναγνωρίζεται και ως είσοδος', () => {
    // Το locale είναι η αυθεντία της ετικέτας· αν κάποιος γράψει αυτό που **βλέπει**,
    // ο αναγνωριστής οφείλει να το δέχεται.
    expect(normalizePropertyType('Σοφίτα')).toBe('loft');
    expect(normalizePropertyType('σοφιτα')).toBe('loft');
    expect(normalizePropertyType('loft')).toBe('loft');
  });

  // ==========================================================================
  // Δ. ΜΕΤΑΛΛΑΞΕΙΣ — η άγκυρα αποδεικνύει ότι μπορεί να κοκκινίσει
  // ==========================================================================

  it('Μ0 — οι κατηγορίες είναι ακριβώς τρεις, καμία σύνθετη (RESO καθαρισμένο)', () => {
    // Το RESO βάζει τη **συναλλαγή** μέσα στο είδος (`Commercial Lease`). Εδώ η
    // συναλλαγή ζει στο `OFFER_KINDS`, άρα καμία τιμή δεν είναι είδος×συναλλαγή.
    expect([...PROPERTY_CLASSES]).toEqual(['land', 'residential', 'commercial']);
    for (const klass of PROPERTY_CLASSES) {
      expect(klass).not.toMatch(/lease|sale|rent/i);
    }
  });

  it('Μ1 — μια κατηγορία που δεν υπάρχει δίνει ΚΕΝΟ σύνολο, όχι σιωπηλή πτώση', () => {
    // Αν το `propertyTypesOfClass` γινόταν κάποτε «ό,τι δεν ταιριάζει αλλού», αυτό
    // θα επέστρεφε **όλα** τα είδη — η μετάλλαξη που κρατάμε κόκκινη.
    const ghost = 'agricultural' as PropertyClass;
    expect(propertyTypesOfClass(ghost)).toEqual([]);
  });
});
