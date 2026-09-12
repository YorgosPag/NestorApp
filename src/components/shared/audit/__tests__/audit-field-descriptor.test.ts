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
