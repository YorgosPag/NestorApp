/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ: ο έξυπνος διάλογος δεν ζωγραφίζει ΠΟΤΕ ωμό i18n κλειδί (ADR-804 §3)
 * =============================================================================
 *
 * 🔑 **ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ**: ο κατάλογος ετικετών έχει **δύο συμβόλαια** — παλιές εγγραφές
 * δίνουν **έτοιμο κείμενο**, μεταναστευμένες δίνουν **i18n κλειδί**. Η ετικέτα πήγαινε
 * **κατευθείαν** στην οθόνη, οπότε κάθε μεταναστευμένη εγγραφή ζωγράφιζε το κλειδί της.
 * Μετρημένο ζωντανά πριν από τη διόρθωση: **25** κλειδιά για τον τύπο `service`,
 * **3** για τον `contact`.
 *
 * ⚠️ **ΕΞΑΝΤΛΗΤΙΚΑ, ΟΧΙ ΔΕΙΓΜΑ**: ο βρόχος περνά **ΟΛΟΥΣ** τους `DialogEntityType`.
 * Δείγμα θα άφηνε τον επόμενο τύπο να προσγειωθεί με ωμά κλειδιά **αθέατος** — και
 * ακριβώς έτσι έζησαν τα 28 που βρέθηκαν.
 *
 * ⚠️ **ΚΛΕΙΔΩΝΕΙ ΙΔΙΟΤΗΤΑ, ΟΧΙ ΚΕΙΜΕΝΟ**: «καμία ετικέτα δεν μοιάζει με κλειδί» —
 * όχι «η ετικέτα είναι *Επωνυμία*». Άγκυρα που καρφώνει διατύπωση σπάει σε κάθε
 * αλλαγή copywriting και τελικά διαγράφεται.
 */

import { createDialogConfiguration } from '../SmartDialogEngine';
import type { DialogEntityType } from '../smart-dialog-types';

/** Το ΙΔΙΟ μοτίβο που κρίνει ο κώδικας — αν αποκλίνει, η άγκυρα κρίνει άλλο πράγμα. */
const LOOKS_LIKE_I18N_KEY = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/;

const ALL_ENTITY_TYPES: DialogEntityType[] = [
  'contact', 'company', 'project', 'building', 'opportunity', 'property', 'service', 'task',
];

describe('ADR-804 §3 — καμία ωμή i18n συμβολοσειρά στις ετικέτες του διαλόγου', () => {
  it('Π0 — ο πληθυσμός δεν είναι κενός (αλλιώς κάθε «καθαρό» σημαίνει «δεν κοίταξα»)', () => {
    const fields = ALL_ENTITY_TYPES.flatMap((t) => createDialogConfiguration(t, 'create').fields);
    expect(fields.length).toBeGreaterThan(10);
  });

  it.each(ALL_ENTITY_TYPES)('Κ1 — «%s»: καμία ετικέτα δεν είναι ωμό κλειδί', (entityType) => {
    const { fields } = createDialogConfiguration(entityType, 'create');
    const raw = fields
      .map((f) => ({ name: f.name, label: String(f.label ?? '') }))
      .filter((f) => LOOKS_LIKE_I18N_KEY.test(f.label));
    expect(raw).toEqual([]);
  });

  it.each(ALL_ENTITY_TYPES)('Κ2 — «%s»: καμία ετικέτα κενή ή undefined', (entityType) => {
    const { fields } = createDialogConfiguration(entityType, 'create');
    const empty = fields.filter((f) => !f.label || String(f.label).trim() === '');
    expect(empty.map((f) => f.name)).toEqual([]);
  });

  /**
   * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΤΟ Κ4** — το βρήκε **μετάλλαξη που ΕΜΕΙΝΕ ΠΡΑΣΙΝΗ**.
   *
   * Αλλάζοντας τα namespaces σε σκέτο `['common']` **καμία** ετικέτα δεν λύνεται πια,
   * αλλά το `Κ1` έμενε πράσινο: το fail-safe επιστρέφει **ανθρώπινο όνομα πεδίου**,
   * που δεν μοιάζει κλειδί. Δηλαδή ο φρουρός φύλαγε «δεν βγαίνει κλειδί» και **ποτέ**
   * «οι μεταφράσεις όντως βρέθηκαν» — μια σιωπηλή υποβάθμιση σε αγγλικά fallback
   * θα περνούσε αθέατη. *Διορθώθηκε ο φρουρός, όχι η μετάλλαξη.*
   *
   * Το `getFallbackLabel` παράγει `vat_number` → `Vat number`: **πρώτο κεφαλαίο, τα
   * υπόλοιπα πεζά, κάτω παύλες σε κενά**. Μια πραγματική μετάφραση σχεδόν ποτέ δεν
   * συμπίπτει με αυτό — και στα ελληνικά **ποτέ**.
   */
  it('Κ4 — οι ετικέτες είναι ΟΝΤΩΣ μεταφρασμένες, όχι fallback ονόματα πεδίων', () => {
    const fallbackOf = (name: string) =>
      name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
    const { fields } = createDialogConfiguration('company', 'create');
    const resolved = fields.filter((f) => String(f.label) !== fallbackOf(f.name));
    // Ο τύπος «company» έχει **56** μεταφρασμένα κλειδιά που λύνονται 56/56 στο `forms`.
    // Αν σπάσει το namespace, το `resolved` καταρρέει στο μηδέν.
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.length / fields.length).toBeGreaterThan(0.5);
  });

  it('Κ3 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο κατάλογος όντως περιέχει i18n κλειδιά', () => {
    // Χωρίς αυτό, τα Κ1 θα ήταν πράσινα ακόμη κι αν ο κατάλογος ήταν όλος σκέτο κείμενο,
    // δηλαδή ο φρουρός δεν θα είχε αποδείξει ποτέ ότι κοίταξε κάτι επικίνδυνο.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getFieldLabels } = require('../smart-dialog-config');
    const keyish = (['company', 'service', 'contact'] as DialogEntityType[])
      .flatMap((t) => Object.values(getFieldLabels(t) as Record<string, string>))
      .filter((v) => LOOKS_LIKE_I18N_KEY.test(String(v)));
    expect(keyish.length).toBeGreaterThan(0);
  });
});
