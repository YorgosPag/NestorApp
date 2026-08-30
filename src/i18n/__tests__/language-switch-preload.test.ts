/**
 * =============================================================================
 * ADR-831 — ΑΓΚΥΡΕΣ ΤΗΣ ΠΡΟΦΟΡΤΩΣΗΣ ΠΡΙΝ ΤΗΝ ΑΛΛΑΓΗ ΓΛΩΣΣΑΣ
 * =============================================================================
 *
 * Το ερώτημα: *«ΠΟΙΑ κείμενα πρέπει να φτάσουν πριν γυρίσει η οθόνη — και ποιος
 * το αποφασίζει;»*
 *
 * 🔬 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ.** Το ADR-830 έκλεισε τη **μονιμότητα** (το ICU cache
 * κρατούσε το ελληνικό για πάντα). Έμεινε το **καρέ**: όποιο namespace δεν ήταν
 * στη **χειρόγραφη λίστα** του καλούντος έμπαινε στη νέα γλώσσα *μετά* το
 * `changeLanguage`, οπότε το i18next απαντούσε από το `fallbackLng` και ο χρήστης
 * έβλεπε ελληνικό κείμενο σε αγγλική οθόνη — για λίγο, αλλά ορατά.
 *
 * 🔑 **Η ΑΠΑΝΤΗΣΗ ΔΕΝ ΓΡΑΦΤΗΚΕ, ΒΡΕΘΗΚΕ.** Το `bundle-registry` καταγράφει ήδη
 * **κάθε** bundle που εγκαταστάθηκε, δηλαδή ακριβώς ό,τι **ζήτησε** η εφαρμογή. Η
 * λίστα αντικαταστάθηκε από **μέτρηση**.
 *
 * ⚠️ **ΤΟ `Κ1` ΕΙΝΑΙ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ**: εκτελεί την **παλιά** απόφαση πάνω στα ίδια
 * δεδομένα και απαιτεί να δει το κενό. Χωρίς αυτό, το `Κ2` θα ήταν πράσινο ακόμα
 * κι αν το πρόβλημα δεν υπήρξε ποτέ (CHECK 3.54 / ADR-587 §6.1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-831-language-switch-preload.md
 * =============================================================================
 */

import { resolveNamespacesToPreload } from '../language-switch-preload';
import {
  getRequestedNamespaces,
  recordLoaderInstall,
  recordShellBootstrap,
  resetBundleRegistry,
} from '../bundle-registry';

/** Ό,τι δήλωνε ο επιλογέας της κεφαλίδας πριν το ADR-831. */
const DECLARED = 'common|common-actions';

/** Η **παλιά** απόφαση, αυτούσια — ο παρονομαστής, όχι υλοποίηση σε χρήση. */
const legacyResolve = (namespaceKey: string): string[] =>
  namespaceKey ? namespaceKey.split('|') : [];

beforeEach(() => {
  resetBundleRegistry();
});

describe('ADR-831 — τι προφορτώνεται πριν γυρίσει η οθόνη', () => {
  it('Κ1 (ΠΑΡΟΝΟΜΑΣΤΗΣ) — η χειρόγραφη λίστα ΔΕΝ βλέπει το namespace της σελίδας', () => {
    // Η ακριβής σκηνή του ADR-830 §1: ο χρήστης στέκεται στα εισερχόμενα εντολών.
    recordLoaderInstall('el', 'property-market');
    recordLoaderInstall('el', 'common');

    const legacy = legacyResolve(DECLARED);

    // 🔴 ΑΥΤΟ είναι το κενό: το namespace που ζωγραφίζει η οθόνη λείπει.
    expect(legacy).not.toContain('property-market');
    expect(getRequestedNamespaces()).toContain('property-market');
  });

  it('Κ2 (ΘΕΡΑΠΕΙΑ) — το μητρώο το φέρνει, χωρίς κανείς να το δηλώσει', () => {
    recordLoaderInstall('el', 'property-market');
    recordLoaderInstall('el', 'common');

    expect(resolveNamespacesToPreload(DECLARED)).toContain('property-market');
  });

  it('Κ3 — ΕΝΩΣΗ: η δήλωση του καλούντος τιμάται ΚΑΙ όταν δεν έχει φορτωθεί ποτέ', () => {
    // Καμία εγγραφή στο μητρώο: το μόνο που υπάρχει είναι η **πρόθεση**.
    expect(resolveNamespacesToPreload('admin')).toContain('admin');
  });

  it('Κ4 — ΦΙΛΤΡΟ: ό,τι δεν ξέρει ο loader ΔΕΝ ζητιέται', () => {
    // Το μητρώο κρατά και ονόματα χωρίς `case` στον loader· ένα δυναμικό `import`
    // γι' αυτά είναι πληρωμένο ταξίδι για άδειο bundle, σε κάθε αλλαγή γλώσσας.
    recordLoaderInstall('el', 'κανένα-τέτοιο-namespace');
    recordLoaderInstall('el', 'property-market');

    const resolved = resolveNamespacesToPreload('');

    expect(resolved).toContain('property-market');
    expect(resolved).not.toContain('κανένα-τέτοιο-namespace');
  });

  it('Κ5 — ΓΛΩΣΣΑ-ΑΓΝΩΣΤΙΚΟ: ο κύκλος el→en→el δεν ξεχνά το ενδιάμεσο', () => {
    // Αν το μητρώο ρωτιόταν «τι έχω στα ΕΛΛΗΝΙΚΑ;», το `crm` (που φορτώθηκε μόνο
    // όσο η οθόνη ήταν αγγλική) θα έλειπε στην επιστροφή — και το καρέ θα
    // ξαναγεννιόταν, μία μετάβαση αργότερα.
    recordLoaderInstall('el', 'property-market');
    recordLoaderInstall('en', 'crm');

    const resolved = resolveNamespacesToPreload('');

    expect(resolved).toEqual(expect.arrayContaining(['property-market', 'crm']));
  });

  it('Κ6 — τα `shell-partial` μετρούν: κομμένο bundle σημαίνει ΠΕΡΙΣΣΟΤΕΡΟΥΣ αναγνώστες', () => {
    recordShellBootstrap('el', ['projects'], []);

    expect(getRequestedNamespaces()).toContain('projects');
    expect(resolveNamespacesToPreload('')).toContain('projects');
  });

  it('Κ7 — ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ ΣΕΙΡΑ, ανεξάρτητη από τη διαδρομή πλοήγησης', () => {
    // Η σειρά ενός `Map` είναι σειρά εισαγωγής — δηλαδή «ποια σελίδα άνοιξε πρώτη».
    recordLoaderInstall('el', 'projects');
    recordLoaderInstall('el', 'common');
    const routeA = getRequestedNamespaces();

    resetBundleRegistry();
    recordLoaderInstall('el', 'common');
    recordLoaderInstall('el', 'projects');

    expect(getRequestedNamespaces()).toEqual(routeA);
  });

  it('Κ8 — χωρίς δήλωση ΚΑΙ χωρίς μητρώο, δεν επινοεί τίποτα', () => {
    expect(resolveNamespacesToPreload('')).toEqual([]);
  });
});
