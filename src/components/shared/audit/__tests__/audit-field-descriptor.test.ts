/**
 * ΑΓΚΥΡΕΣ — ADR-852 Φ2: η ετικέτα λύνεται **ζωντανά**, και το στιγμιότυπο **δηλώνεται**.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το διπλό κανάλι (§3.1) είναι απόφαση που μπορεί να «απλοποιηθεί»
 * αργότερα από κάποιον που βλέπει δύο πηγές ονόματος και νομίζει ότι η μία περισσεύει.
 * Δεν περισσεύει: η μία είναι το **τώρα** (μεταφράζεται, βελτιώνεται αναδρομικά), η άλλη
 * το **τότε** (επιβιώνει μετονομασίας). Εδώ καρφώνεται ότι κρατιούνται **και οι δύο**,
 * με τη σωστή προτεραιότητα.
 *
 * ⚠️ Η ΠΙΟ ΚΡΙΣΙΜΗ ΑΓΚΥΡΑ ΕΙΝΑΙ Η «Α4»: τα BIM registries γράφουν `label: 'width'` —
 * το όνομα του πεδίου ως ετικέτα του. Αν το σημαίναμε ως «πεδίο που αποσύρθηκε», θα
 * λέγαμε ψέματα με πρόσωπο ειλικρίνειας σε **133 από τα 279** πεδία.
 */

import {
  resolveFieldLabel,
  resolveTrackedFieldDef,
} from '../audit-field-descriptor';
// ADR-852 §4.8 (άγκυρα Ζ4) — το ΠΡΑΓΜΑΤΙΚΟ μητρώο, ώστε η κάλυψη μετάφρασης να
// ελέγχεται πάνω στα πεδία που δηλώνονται όντως, όχι σε χειρόγραφη λίστα που παλιώνει.
import { getTrackedFieldsForEntityAuditType } from '@/config/audit-tracked-fields';
import type { TrackedFieldDef } from '@/lib/audit/tracked-field-def';

/** Μεταφραστής που ξέρει ΜΟΝΟ τα κλειδιά του πίνακα· για κάθε άλλο επιστρέφει το κλειδί. */
const translatorOf =
  (known: Record<string, string>) =>
  (key: string): unknown =>
    known[key] ?? key;

const scalar = (label: string, extra: Partial<TrackedFieldDef> = {}): TrackedFieldDef =>
  ({ kind: 'scalar', label, ...extra }) as TrackedFieldDef;

describe('ADR-852 Φ2 — resolveFieldLabel: ζωντανά πρώτα', () => {
  it('Α1 — το `labelKey` του μητρώου νικά κάθε άλλη πηγή', () => {
    const result = resolveFieldLabel({
      entityType: 'column',
      field: 'width',
      def: scalar('width', { labelKey: 'audit.fields.column.width' }),
      storedLabel: 'ΠΑΛΙΟ ΟΝΟΜΑ',
      translate: translatorOf({
        'audit.fields.column.width': 'Πλάτος',
        'audit.fields.width': 'ΓΕΝΙΚΟ',
      }),
    });
    expect(result).toEqual({ text: 'Πλάτος', isSnapshot: false });
  });

  it('Α2 — η ΕΙΔΙΚΗ ανά οντότητα ετικέτα προηγείται της γενικής (σημερινή συμπεριφορά)', () => {
    const result = resolveFieldLabel({
      entityType: 'property',
      field: 'status',
      def: undefined,
      storedLabel: undefined,
      translate: translatorOf({
        'audit.fields.property.status': 'Κατάσταση ακινήτου',
        'audit.fields.status': 'Κατάσταση',
      }),
    });
    expect(result).toEqual({ text: 'Κατάσταση ακινήτου', isSnapshot: false });
  });

  it('Α3 — χωρίς ειδική, πέφτει στη γενική', () => {
    const result = resolveFieldLabel({
      entityType: 'column',
      field: 'status',
      def: undefined,
      storedLabel: undefined,
      translate: translatorOf({ 'audit.fields.status': 'Κατάσταση' }),
    });
    expect(result).toEqual({ text: 'Κατάσταση', isSnapshot: false });
  });
});

describe('ADR-852 Φ2 — resolveFieldLabel: το στιγμιότυπο δηλώνεται, ποτέ δεν κρύβεται', () => {
  it('Α4 🔴 — `label` ΙΣΟ με το όνομα του πεδίου ΔΕΝ είναι στιγμιότυπο (το κενό των 133)', () => {
    // Αυτό ΑΚΡΙΒΩΣ γράφουν σήμερα τα BIM registries: `width: 'width'`.
    const result = resolveFieldLabel({
      entityType: 'column',
      field: 'width',
      def: scalar('width'),
      storedLabel: 'width',
      translate: translatorOf({}),
    });
    expect(result).toEqual({ text: 'width', isSnapshot: false });
  });

  it('Α5 — `label` ΔΙΑΦΟΡΕΤΙΚΟ και άγνωστο στο μητρώο ⇒ στιγμιότυπο ΜΕ σήμανση', () => {
    const result = resolveFieldLabel({
      entityType: 'contact',
      field: 'legacyField',
      def: undefined,
      storedLabel: 'Παλαιό Πεδίο',
      translate: translatorOf({}),
    });
    expect(result).toEqual({ text: 'Παλαιό Πεδίο', isSnapshot: true });
  });

  it('Α6 — τίποτα γνωστό ⇒ ωμό όνομα πεδίου, ΟΡΑΤΟ (όχι σιωπηλό)', () => {
    const result = resolveFieldLabel({
      entityType: 'column',
      field: 'baseBinding',
      def: undefined,
      storedLabel: undefined,
      translate: translatorOf({}),
    });
    expect(result).toEqual({ text: 'baseBinding', isSnapshot: false });
  });
});

describe('ADR-852 Φ2 — resolveFieldLabel: τι μετράει ως «δεν λύθηκε»', () => {
  it('Α7 — μετάφραση που επιστρέφει ΤΟ ΙΔΙΟ ΤΟ ΚΛΕΙΔΙ δεν είναι μετάφραση', () => {
    const result = resolveFieldLabel({
      entityType: 'column',
      field: 'width',
      def: undefined,
      storedLabel: 'Πλάτος Στιγμιοτύπου',
      translate: (key: string) => key, // i18next: άγνωστο κλειδί → το ίδιο το κλειδί
    });
    expect(result).toEqual({ text: 'Πλάτος Στιγμιοτύπου', isSnapshot: true });
  });

  it('Α8 — μη-φύλλο κόμβος (αντικείμενο) δεν είναι μετάφραση', () => {
    // Το i18next επιστρέφει ΑΝΤΙΚΕΙΜΕΝΟ όταν το κλειδί δείχνει σε υποδέντρο —
    // π.χ. `audit.fields.column` ενώ υπάρχει `audit.fields.column.width`.
    const result = resolveFieldLabel({
      entityType: 'column',
      field: 'width',
      def: undefined,
      storedLabel: undefined,
      translate: () => ({ width: 'Πλάτος' }),
    });
    expect(result).toEqual({ text: 'width', isSnapshot: false });
  });
});

describe('ADR-852 Φ2 — resolveTrackedFieldDef: η γέφυρα προς το ΠΡΑΓΜΑΤΙΚΟ μητρώο', () => {
  it('Α9 ΠΑΡΟΝΟΜΑΣΤΗΣ — βρίσκει υπαρκτό πεδίο υπαρκτής οντότητας', () => {
    // Χωρίς αυτό, οι Α10/Α11 θα «αποδείκνυαν» σωστή συμπεριφορά πάνω σε νεκρό μητρώο.
    expect(resolveTrackedFieldDef('column', 'width')).toBeDefined();
  });

  it('Α10 — άγνωστος τύπος οντότητας ⇒ undefined, ποτέ σφάλμα', () => {
    expect(resolveTrackedFieldDef('δεν-υπάρχει', 'width')).toBeUndefined();
    expect(resolveTrackedFieldDef(null, 'width')).toBeUndefined();
  });

  it('Α11 — άγνωστο πεδίο γνωστής οντότητας ⇒ undefined', () => {
    expect(resolveTrackedFieldDef('column', 'δεν-υπάρχει-πεδίο')).toBeUndefined();
  });
});

// ============================================================================
// ΑΓΚΥΡΕΣ Ζ — ADR-852 §4.8 (Εργασία Β): οι τρεις οντότητες που ΕΓΡΑΦΑΝ ΧΩΡΙΣ ΜΗΤΡΩΟ
// ============================================================================

/**
 * ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ: `company`, `text_template` και `custom_dictionary_entry` έγραφαν ιστορικό
 * μέσω απευθείας `EntityAuditService.recordChange`, με `changes[]` χτισμένο **με το χέρι** —
 * άρα ο δρομολογητής επέστρεφε `null` και δύο από αυτές κουβαλούσαν **ωμά ελληνικά μέσα σε
 * `.ts`** ως ετικέτες, δηλαδή κείμενο που **δεν μεταφραζόταν ΠΟΤΕ** στα αγγλικά (N.11).
 *
 * Η θεραπεία έχει **δύο** σκέλη που μπορούν να αποκλίνουν σιωπηλά — γι' αυτό δύο ομάδες
 * αγκυρών: το **μητρώο** (case στον δρομολογητή) και η **μετάφραση** (φωλιά i18n σε el+en).
 * Ένα μητρώο χωρίς μετάφραση δείχνει ωμό κλειδί· μια μετάφραση χωρίς μητρώο αφήνει τον
 * reader χωρίς περιγραφέα για `quantity`/`enumCatalog`/`fk` στο μέλλον.
 */
const WORK_B_ENTITIES = ['company', 'text_template', 'custom_dictionary_entry'] as const;

describe('ADR-852 §4.8 — το μητρώο γνωρίζει πλέον τις τρεις οντότητες', () => {
  it.each(WORK_B_ENTITIES)(
    'Ζ0 ΠΑΡΟΝΟΜΑΣΤΗΣ — «%s»: ο δρομολογητής ΔΕΝ επιστρέφει πια null',
    (entityType) => {
      // Το μάθημα της Α9: χωρίς αυτό, τα Ζ1-Ζ3 θα «αποδείκνυαν» σωστή συμπεριφορά πάνω
      // σε ΝΕΚΡΟ μητρώο — το i18n λύνει την ετικέτα ακόμα κι όταν `def === undefined`.
      expect(resolveTrackedFieldDef(entityType, 'name') ?? resolveTrackedFieldDef(entityType, 'term'))
        .toBeDefined();
    },
  );
});

describe('ADR-852 §4.8 — η ετικέτα λύνεται ΖΩΝΤΑΝΑ, σε δύο γλώσσες', () => {
  it('Ζ1 — πεδίο ΧΩΡΙΣ γενικό κλειδί (`scope`) λύνεται από την ΕΙΔΙΚΗ φωλιά', () => {
    // Το `scope` δεν υπάρχει στο γενικό `audit.fields.*` — μετρημένο. Πριν τη §4.8 ο
    // reader έπεφτε στο αποθηκευμένο ελληνικό 'Εμβέλεια', που ΔΕΝ είχε αγγλικό αδελφάκι.
    const result = resolveFieldLabel({
      entityType: 'text_template',
      field: 'scope',
      def: scalar('scope'),
      storedLabel: undefined,
      translate: translatorOf({ 'audit.fields.text_template.scope': 'Εμβέλεια' }),
    });
    expect(result).toEqual({ text: 'Εμβέλεια', isSnapshot: false });
  });

  it('Ζ2 — dot-notation πεδίο (`content.paragraphs`) λύνεται από φωλιά-σε-φωλιά', () => {
    // Ίδιο σχήμα με το `audit.fields.property.commercial.*` — το κλειδί που παράγεται
    // είναι `audit.fields.text_template.content.paragraphs`.
    const result = resolveFieldLabel({
      entityType: 'text_template',
      field: 'content.paragraphs',
      def: scalar('content.paragraphs'),
      storedLabel: undefined,
      translate: translatorOf({
        'audit.fields.text_template.content.paragraphs': 'Πλήθος παραγράφων',
      }),
    });
    expect(result).toEqual({ text: 'Πλήθος παραγράφων', isSnapshot: false });
  });

  it('Ζ3 🔴 — το ΖΩΝΤΑΝΟ i18n νικά το ΑΠΟΘΗΚΕΥΜΕΝΟ ελληνικό των παλιών εγγραφών', () => {
    // ΚΡΙΣΙΜΟ για μηδέν παλινδρόμηση: οι ήδη γραμμένες εγγραφές κρατούν `label: 'Όρος'`.
    // Μετά τη §4.8 πρέπει να δείχνουν τη ΜΕΤΑΦΡΑΣΗ (που στα αγγλικά λέει «Term»), ΟΧΙ το
    // παγωμένο ελληνικό — και ΟΧΙ σημασμένο ως στιγμιότυπο.
    const result = resolveFieldLabel({
      entityType: 'custom_dictionary_entry',
      field: 'term',
      def: scalar('term'),
      storedLabel: 'Όρος',
      translate: translatorOf({ 'audit.fields.custom_dictionary_entry.term': 'Term' }),
    });
    expect(result).toEqual({ text: 'Term', isSnapshot: false });
  });
});

/**
 * 🔒 Η ΑΓΚΥΡΑ ΠΟΥ ΚΑΝΕΙ ΤΟ «ΜΗΤΡΩΟ ΧΩΡΙΣ ΜΕΤΑΦΡΑΣΗ» ΜΗ ΕΚΦΡΑΣΙΜΟ.
 *
 * Διαβάζει τα **πραγματικά** locale JSON (όχι mock): κάθε πεδίο που δηλώνει το μητρώο
 * για τις τρεις οντότητες **οφείλει** να έχει κλειδί σε **el ΚΑΙ en**. Χωρίς αυτό, μια
 * μελλοντική προσθήκη πεδίου στο μητρώο θα εμφανιζόταν ως **ωμό κλειδί** στην οθόνη —
 * σιωπηλά, και μόνο στη μία γλώσσα (το σχήμα που γέννησε ολόκληρο το ADR-852).
 */
describe('ADR-852 §4.8 — κάθε πεδίο του μητρώου έχει μετάφραση σε ΚΑΙ ΤΙΣ ΔΥΟ γλώσσες', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const BUNDLES: Record<'el' | 'en', unknown> = {
    el: require('@/i18n/locales/el/common-audit.json'),
    en: require('@/i18n/locales/en/common-audit.json'),
  };
  /* eslint-enable @typescript-eslint/no-require-imports */

  /** Διασχίζει dotted κλειδί — το ίδιο που κατασκευάζει το `resolveFieldLabel`. */
  function lookup(bundle: unknown, dotted: string): unknown {
    return dotted
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node !== null && typeof node === 'object'
            ? (node as Record<string, unknown>)[part]
            : undefined,
        bundle,
      );
  }

  it.each(WORK_B_ENTITIES)('Ζ4 🔴 — «%s»: κάθε πεδίο μεταφράζεται σε el ΚΑΙ en', (entityType) => {
    const registry = getTrackedFieldsForEntityAuditType(entityType);
    expect(registry).not.toBeNull();

    const fields = Object.keys(registry ?? {});
    // ΠΑΡΟΝΟΜΑΣΤΗΣ: κενό μητρώο θα περνούσε το `for` δωρεάν — «πράσινο επειδή κανείς
    // δεν κοίταξε». Το πλήθος δηλώνεται ρητά ώστε η αφαίρεση πεδίου να ΦΑΙΝΕΤΑΙ.
    expect(fields.length).toBeGreaterThan(0);

    for (const field of fields) {
      // 🔑 Η ΕΡΩΤΗΣΗ ΕΙΝΑΙ «ΛΥΝΕΤΑΙ Η ΕΤΙΚΕΤΑ;», ΟΧΙ «ΥΠΑΡΧΕΙ ΕΙΔΙΚΟ ΚΛΕΙΔΙ;» — και η
      // διαφορά μετρήθηκε: το `company` **ΔΕΝ ΜΠΟΡΕΙ** να έχει φωλιά οντότητας, γιατί
      // υπάρχει ήδη **πεδίο** με το ίδιο όνομα στο γενικό επίπεδο (`audit.fields.company`
      // = «Εταιρεία», πεδίο έργων/κτιρίων). Φωλιά εκεί θα έκανε το βήμα 3 να επιστρέφει
      // **αντικείμενο** ⇒ ο `translated()` το απορρίπτει ⇒ η ετικέτα «Εταιρεία» θα
      // **χανόταν** από κάθε έργο/κτίριο (ακριβώς το σενάριο της άγκυρας Α8).
      // Άρα ο έλεγχος μιμείται τη ΣΕΙΡΑ του `resolveFieldLabel`: ειδικό → γενικό.
      const specific = `audit.fields.${entityType}.${field}`;
      const generic = `audit.fields.${field}`;
      for (const lang of ['el', 'en'] as const) {
        const resolved = lookup(BUNDLES[lang], specific) ?? lookup(BUNDLES[lang], generic);
        expect(typeof resolved).toBe('string');
      }
    }
  });
});
