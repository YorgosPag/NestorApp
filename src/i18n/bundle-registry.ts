/**
 * =============================================================================
 * 🏢 BUNDLE COMPLETENESS REGISTRY — ADR-744 §11 (SSoT)
 * =============================================================================
 *
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΤΟ i18next ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΑΠΑΝΤΗΣΕΙ.
 *
 * Το `i18n.hasResourceBundle(lng, ns)` απαντά **«υπάρχει κάτι;»**. Δεν υπάρχει
 * API που να απαντά **«υπάρχει ΟΛΟ;»** — το i18next δεν έχει καθόλου έννοια
 * πληρότητας ανά namespace, ούτε με `partialBundledLanguages`. Όσο ο σύγχρονος
 * bootstrap έγραφε **ολόκληρα** namespaces, οι δύο ερωτήσεις ήταν ταυτόσημες
 * και η διάκριση δεν κόστιζε τίποτα.
 *
 * Το ADR-744 τερμάτισε αυτή την ταύτιση: το shell slice κόβει σε **επίπεδο
 * κλειδιού**, οπότε επτά namespaces μπαίνουν στο i18next **κομμένα** — το
 * `projects` με **1 από 49** top-level κλειδιά. Από εκείνη τη στιγμή, κάθε
 * σημείο που ρωτούσε `hasResourceBundle` για να αποφασίσει «χρειάζεται
 * φόρτωση;» έπαιρνε `true` και **παρέλειπε τη φόρτωση για πάντα**.
 *
 * ## Η ρητή, γραπτή παραδοχή που ήταν λάθος
 *
 * Το `scripts/lib/i18n-shell-slice/slice-build.js` το είχε δηλώσει ως ασφάλεια:
 *
 *   «A namespace present in i18next with SOME of its keys is not a half-loaded
 *    namespace — addResourceBundle(deep, overwrite) merges the full version over
 *    the slice **when the async load lands** […] The slice can only ever ADD
 *    correct strings to the first frame; it can never remove one.»
 *
 * Το merge όντως δουλεύει. Αλλά η φόρτωση **δεν landάριζε ποτέ**: το
 * `loadNamespace` έκανε early-return στο `hasResourceBundle` πριν φτάσει καν στο
 * `addResourceBundle`. Η πρόταση «behaves exactly as it does today» ήταν ψευδής,
 * και το σφάλμα ήταν μια **γραπτή παραδοχή** — όχι μια παράλειψη.
 *
 * Μετρημένο 2026-08-07 στο `/projects`: ωμό `page.loadingMessage` στην οθόνη ενώ
 * η μετάφραση υπάρχει στο `locales/el/projects.json:149`, το namespace έχει
 * loader (CHECK 3.36 πράσινο), το κλειδί υπάρχει (CHECK 3.8 πράσινο) και οι
 * τύποι είναι φρέσκοι (CHECK 3.33 πράσινο). **Καμία πύλη δεν ρωτούσε αν το
 * bundle είναι πλήρες**, γιατί μέχρι το ADR-744 η ερώτηση δεν είχε νόημα.
 *
 * ## Γιατί μητρώο και όχι «πιο έξυπνος έλεγχος»
 *
 * Η πληρότητα **δεν είναι συναγώγιμη** από το περιεχόμενο: για να συγκρίνεις το
 * bundle με το πλήρες αρχείο πρέπει να κατεβάσεις το πλήρες αρχείο, δηλαδή να
 * κάνεις ακριβώς ό,τι ήθελες να αποφύγεις. Άρα η κατάσταση πρέπει να **δηλωθεί**
 * από όποιον γράφει το bundle, τη στιγμή που το γράφει. Αυτό κάνει εδώ.
 *
 * ## Τρεις ρητές καταστάσεις — καμία σιωπηλή υπόθεση
 *
 * | κατάσταση       | σημαίνει                                              |
 * |-----------------|-------------------------------------------------------|
 * | `absent`        | το i18next δεν έχει τίποτα γι' αυτό το namespace       |
 * | `shell-partial` | το bootstrap slice έγραψε **υποσύνολο** κλειδιών       |
 * | `complete`      | ο loader εγκατέστησε το **πλήρες** αρχείο locale       |
 *
 * Το `shell-partial` **δεν** είναι σφάλμα — είναι το σχέδιο του ADR-744. Είναι
 * σφάλμα μόνο όταν κάποιος το διαβάσει ως `complete`.
 *
 * ⚠️ **ΜΗΝ ξαναγράψεις κανέναν έλεγχο «χρειάζεται φόρτωση;» ως
 *    `hasResourceBundle`.** Είναι η ίδια ερώτηση που γέννησε το bug, και είναι
 *    πάντα `true` ακριβώς στην περίπτωση που σε ενδιαφέρει.
 *
 * @module i18n/bundle-registry
 * @see docs/centralized-systems/reference/adrs/ADR-744-i18n-shell-slice.md §9
 */

/** Η πληρότητα ενός resource bundle μέσα στο i18next. */
export type BundleState = 'absent' | 'shell-partial' | 'complete';

/** `${language}:${namespace}` → κατάσταση. Ό,τι λείπει είναι `absent`. */
const bundleStates = new Map<string, BundleState>();

const bundleKey = (language: string, namespace: string): string => `${language}:${namespace}`;

/**
 * Δηλώνει τι έγραψε ο **σύγχρονος bootstrap** (`src/i18n/config.ts`).
 *
 * @param language   η γλώσσα του slice — `el` σήμερα (ADR-744 §4)
 * @param namespaces κάθε namespace που το slice εγκατέστησε
 * @param whole      όσα από αυτά μπήκαν **ΟΛΟΚΛΗΡΑ**· παράγονται από τον
 *                   generator (`shell-slice.whole.json`), ποτέ χειρόγραφα —
 *                   μια χειρόγραφη λίστα εδώ θα ήταν ακριβώς η απόκλιση που το
 *                   ADR-744 υπάρχει για να καταργήσει.
 *
 * Δεν υποβαθμίζει ποτέ ένα ήδη `complete` bundle: αν ο loader πρόλαβε τον
 * bootstrap, η δική του δήλωση είναι η ισχυρότερη.
 */
export function recordShellBootstrap(
  language: string,
  namespaces: readonly string[],
  whole: readonly string[],
): void {
  const wholeSet = new Set(whole);
  for (const namespace of namespaces) {
    const key = bundleKey(language, namespace);
    if (bundleStates.get(key) === 'complete') continue;
    bundleStates.set(key, wholeSet.has(namespace) ? 'complete' : 'shell-partial');
  }
}

/**
 * Δηλώνει ότι ο loader εγκατέστησε το **πλήρες** αρχείο locale.
 *
 * Καλείται ΜΟΝΟ μετά από επιτυχές `addResourceBundle` με μη κενό περιεχόμενο —
 * ένα άδειο bundle από αποτυχημένο import δεν είναι πληρότητα, είναι αποτυχία,
 * και το να σημειωθεί ως `complete` θα έκλεινε τη μοναδική πόρτα επανάληψης.
 */
export function recordLoaderInstall(language: string, namespace: string): void {
  bundleStates.set(bundleKey(language, namespace), 'complete');
}

/** Η κατάσταση ενός bundle. Άγνωστο ⇒ `absent`. */
export function getBundleState(language: string, namespace: string): BundleState {
  return bundleStates.get(bundleKey(language, namespace)) ?? 'absent';
}

/**
 * Η **μοναδική** ερώτηση που επιτρέπεται να αποφασίζει «χρειάζεται φόρτωση;».
 */
export function isBundleComplete(language: string, namespace: string): boolean {
  return getBundleState(language, namespace) === 'complete';
}

/** Μηδενισμός — αποκλειστικά για tests που στήνουν καθαρό boot. */
export function resetBundleRegistry(): void {
  bundleStates.clear();
}
