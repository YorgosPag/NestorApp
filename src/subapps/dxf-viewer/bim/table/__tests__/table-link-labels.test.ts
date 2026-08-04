/**
 * ADR-751 Φ8 — **πώς λέγεται και τι αντιγράφεται** ένας σύνδεσμος.
 *
 * Το κρίσιμο δεν είναι οι ετικέτες — είναι το {@link linkClipboardText}. Η «αντιγραφή
 * διεύθυνσης» που βάζει `mailto:` στο πρόχειρο **μοιάζει** να δουλεύει: ο χρήστης βλέπει
 * μήνυμα επιτυχίας, και το ελάττωμα εμφανίζεται αργότερα, σε **άλλη** εφαρμογή, όταν το
 * πεδίο παραλήπτη απορρίψει τη διεύθυνση. Είναι ακριβώς το είδος σφάλματος που καμία
 * χειροκίνητη δοκιμή στην οθόνη δεν πιάνει, γιατί η οθόνη δείχνει «αντιγράφηκε».
 *
 * @see bim/table/table-link-labels.ts
 */

import {
  LINK_ACTION_KEY,
  LINK_COPY_KEY,
  linkClipboardText,
} from '../table-link-labels';
import type { TextLinkKind } from '@/lib/validation/text-link-segments';

const ALL_KINDS: readonly TextLinkKind[] = ['email', 'phone', 'url'];

describe('🔴 τι μπαίνει στο πρόχειρο — το ωφέλιμο φορτίο, όχι το σχήμα', () => {
  it('e-mail: ΧΩΡΙΣ «mailto:» — αλλιώς το πεδίο παραλήπτη το απορρίπτει', () => {
    expect(linkClipboardText('email', 'mailto:georgios.pagonis@gmail.com')).toBe(
      'georgios.pagonis@gmail.com',
    );
  });

  it('τηλέφωνο: ΧΩΡΙΣ «tel:» — και στην κανονικοποιημένη μορφή που όντως καλείται', () => {
    expect(linkClipboardText('phone', 'tel:2310788493')).toBe('2310788493');
  });

  it('ιστοσελίδα: ΜΕ το σχήμα — εκεί το «https://» ΕΙΝΑΙ μέρος της διεύθυνσης', () => {
    expect(linkClipboardText('url', 'https://www.nestorconstruct.gr')).toBe(
      'https://www.nestorconstruct.gr',
    );
  });

  it('δεν κόβει τίποτα όταν το σχήμα λείπει — καμία σιωπηλή ακρωτηρίαση', () => {
    expect(linkClipboardText('email', 'georgios@nestor.gr')).toBe('georgios@nestor.gr');
  });

  it('κόβει ΜΟΝΟ πρόθεμα, όχι εμφάνιση του σχήματος μέσα στο κείμενο', () => {
    // Παθολογική αλλά υπαρκτή περίπτωση: `replace` αντί για έλεγχο προθέματος θα το χαλούσε.
    expect(linkClipboardText('email', 'mailto:a@mailto:b.gr')).toBe('a@mailto:b.gr');
  });
});

describe('οι χάρτες είναι ΚΛΕΙΣΤΟΙ — ο μεταγλωττιστής ζητά το τέταρτο είδος εδώ', () => {
  it.each(ALL_KINDS)('το είδος «%s» έχει κλειδί ενέργειας', (kind) => {
    expect(LINK_ACTION_KEY[kind]).toMatch(/^tableCellLink\./);
  });

  it.each(ALL_KINDS)('το είδος «%s» έχει κλειδί αντιγραφής', (kind) => {
    expect(LINK_COPY_KEY[kind]).toMatch(/^tableCellLink\./);
  });

  it('τα κλειδιά αντιγραφής είναι ΤΡΙΑ ΔΙΑΦΟΡΕΤΙΚΑ — η πρακτική του Chrome', () => {
    // Μία κοινή ετικέτα «Αντιγραφή διεύθυνσης» θα υποσχόταν το ίδιο πράγμα για τρεις
    // διαφορετικές συμπεριφορές του `linkClipboardText` από πάνω.
    expect(new Set(Object.values(LINK_COPY_KEY)).size).toBe(3);
  });
});

describe('🔴 τα κλειδιά ΥΠΑΡΧΟΥΝ στα locale — και στις δύο γλώσσες', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const el = require('../../../../../i18n/locales/el/dxf-viewer.json');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const en = require('../../../../../i18n/locales/en/dxf-viewer.json');

  const lookup = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], bundle);

  const ALL_KEYS = [...Object.values(LINK_ACTION_KEY), ...Object.values(LINK_COPY_KEY)];

  it.each(ALL_KEYS)('«%s» υπάρχει στα ελληνικά', (key) => {
    expect(typeof lookup(el, key)).toBe('string');
  });

  it.each(ALL_KEYS)('«%s» υπάρχει στα αγγλικά', (key) => {
    expect(typeof lookup(en, key)).toBe('string');
  });
});
