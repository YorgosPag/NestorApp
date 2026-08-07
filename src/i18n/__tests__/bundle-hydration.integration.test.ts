/**
 * ADR-744 §11 — Η ΑΠΟΔΕΙΞΗ ΠΑΝΩ ΣΤΟΝ ΠΡΑΓΜΑΤΙΚΟ LOADER.
 *
 * Το `bundle-completeness.test.ts` αποδεικνύει ότι το **μητρώο** λέει την
 * αλήθεια. Αυτό εδώ αποδεικνύει το επόμενο βήμα, που είναι και το μόνο που
 * βλέπει ο χρήστης: ότι ο **πραγματικός** `loadNamespace` — όχι μια μίμησή του —
 * όντως κατεβάζει το πλήρες locale πάνω από ένα κομμένο shell-slice bundle.
 *
 * Η διάκριση δεν είναι σχολαστικότητα. Το bug ΗΤΑΝ ακριβώς εκεί: κάθε δομικό
 * κομμάτι ήταν σωστό (το slice, το merge του `addResourceBundle`, το locale, ο
 * loader του namespace) και μόνο η **συνθήκη εισόδου** στο τελευταίο βήμα ήταν
 * λάθος. Ένα test που στήνει μόνος του το `addResourceBundle` θα ήταν πράσινο
 * και τότε — γιατί δεν θα περνούσε ποτέ από τη γραμμή που έκανε το early-return.
 *
 * Ξεχωριστό αρχείο επειδή ακουμπά το **singleton** του i18next, το ίδιο που
 * κρατά το `lazy-config.ts`.
 */

import i18n, { type Resource } from 'i18next';

import shellSlice from '../generated/shell-slice.el.json';
import shellWholeNamespaces from '../generated/shell-slice.whole.json';
import { loadNamespace } from '../lazy-config';
import { getBundleState, isBundleComplete, recordShellBootstrap, resetBundleRegistry } from '../bundle-registry';

const LANGUAGE = 'el';
const RAW_KEY = 'page.loadingMessage';

/** Ο σύγχρονος μισός του `src/i18n/config.ts`, και τίποτα άλλο: χωρίς preload IIFE. */
async function bootLikeProduction(): Promise<void> {
  resetBundleRegistry();
  const namespaces = Object.keys(shellSlice);
  await i18n.init({
    resources: { [LANGUAGE]: shellSlice } as Resource,
    lng: LANGUAGE,
    fallbackLng: LANGUAGE,
    ns: namespaces,
    defaultNS: 'common',
    initImmediate: false,
    interpolation: { escapeValue: false },
  });
  recordShellBootstrap(LANGUAGE, namespaces, shellWholeNamespaces);
}

describe('ADR-744 §11 — ο loader πάνω σε κομμένο bundle', () => {
  beforeAll(async () => {
    await bootLikeProduction();
  });

  it('στο boot το /projects θα ζωγράφιζε το ωμό κλειδί', () => {
    expect(i18n.hasResourceBundle(LANGUAGE, 'projects')).toBe(true);
    expect(getBundleState(LANGUAGE, 'projects')).toBe('shell-partial');
    expect(i18n.t(RAW_KEY, { ns: 'projects' })).toBe(RAW_KEY);
  });

  it('🔴 ΑΓΚΥΡΑ — το loadNamespace ΔΕΝ κάνει skip σε shell-partial bundle', async () => {
    await loadNamespace('projects', LANGUAGE);

    // Αν κάποιος επαναφέρει το `hasResourceBundle` ως συνθήκη εξόδου, αυτές οι
    // τρεις γραμμές γίνονται κόκκινες με τη σειρά: το bundle μένει κομμένο, το
    // μητρώο δεν προάγεται, και το κλειδί επιστρέφει τον εαυτό του — δηλαδή
    // ακριβώς το string που είδε ο χρήστης στην οθόνη.
    expect(isBundleComplete(LANGUAGE, 'projects')).toBe(true);
    expect(i18n.t(RAW_KEY, { ns: 'projects' })).not.toBe(RAW_KEY);
    expect(i18n.t(RAW_KEY, { ns: 'projects' })).toContain('Φόρτωση');
  });

  it('τα υπόλοιπα 48 top-level κλειδιά ήρθαν κι αυτά, όχι μόνο το ένα που ζητήθηκε', () => {
    const bundle = i18n.getResourceBundle(LANGUAGE, 'projects') as Record<string, unknown>;
    // Το slice έφερνε ΕΝΑ (`tabs`). Το merge πρέπει να έχει φέρει όλο το αρχείο.
    expect(Object.keys(bundle).length).toBeGreaterThan(40);
    expect(bundle).toHaveProperty('tabs');
    expect(bundle).toHaveProperty('page');
  });

  it('δεύτερη κλήση σε ΠΛΗΡΕΣ bundle κάνει skip — το μητρώο δεν είναι μόνο για το bug', async () => {
    const before = i18n.getResourceBundle(LANGUAGE, 'projects') as Record<string, unknown>;
    await loadNamespace('projects', LANGUAGE);
    expect(i18n.getResourceBundle(LANGUAGE, 'projects')).toBe(before);
  });

  it('namespace που ΔΕΝ αγγίζει το slice φορτώνεται κανονικά', async () => {
    expect(getBundleState(LANGUAGE, 'accounting')).toBe('absent');
    await loadNamespace('accounting', LANGUAGE);
    expect(isBundleComplete(LANGUAGE, 'accounting')).toBe(true);
  });
});
