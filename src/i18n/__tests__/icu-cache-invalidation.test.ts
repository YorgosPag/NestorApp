/**
 * =============================================================================
 * ADR-830 — ΑΓΚΥΡΕΣ ΤΗΣ ΑΚΥΡΩΣΗΣ ΤΟΥ ICU CACHE
 * =============================================================================
 *
 * Το ερώτημα: *«όταν φτάνει το σωστό κείμενο, το ξαναρωτά κανείς;»*
 *
 * 🔬 **ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (μετρημένο ζωντανά στον browser, 30/08/2026).** Αλλαγή
 * γλώσσας el→en με την οθόνη ανοιχτή: το **κέλυφος** γύριζε στα αγγλικά, το
 * **περιεχόμενο κάθε σελίδας** έμενε ελληνικό **οριστικά** — 7+ δευτερόλεπτα,
 * μετά από client navigation, για πάντα. Ο store όμως είχε το σωστό αγγλικό:
 * `store.getResource('en','property-market','mandate.inbox.title')` έδινε
 * *«Incoming mandate requests»* ενώ το `t()` της **ίδιας στιγμής** έδινε
 * *«Εισερχόμενα αιτήματα ανάθεσης»*. Άδειασμα του `icu.mem.en` διόρθωνε το `t()`
 * **ακαριαία** — εκεί κλείδωσε η αιτία.
 *
 * ⛔ **Η ΑΙΤΙΑ.** Το `i18next-icu` κρατά memoized `IntlMessageFormat` ανά
 * `"<γλώσσα>.<ns>.<κλειδί>"`, όπου η γλώσσα είναι εκείνη που **ζητήθηκε**, όχι
 * εκείνη από την οποία **λύθηκε**. Στο καρέ όπου `lng==='en'` αλλά το lazy
 * bundle δεν έχει προσγειωθεί, το i18next λύνει από `fallbackLng: 'el'` και το
 * ICU αποθηκεύει το **ελληνικό** κείμενο κάτω από κλειδί **`en.…`**. Το
 * `clearCache()` υπάρχει στη βιβλιοθήκη αλλά δένεται **μόνο** μέσω
 * `bindI18n` / `bindI18nStore`, που έχουν **`''` ως default** — άρα με σκέτο
 * `.use(ICU)` οι handlers **δεν εγγράφονται ποτέ**.
 *
 * 🔑 **ΓΙΑΤΙ ΤΟ `Κ1` ΕΙΝΑΙ ΤΟ ΣΗΜΑΝΤΙΚΟΤΕΡΟ TEST ΕΔΩ.** Στήνει το **χαλασμένο**
 * στήσιμο (σκέτο `.use(ICU)`) και απαιτεί να δει τη **ΒΛΑΒΗ**. Χωρίς αυτό, το
 * `Κ2` θα μπορούσε να είναι πράσινο επειδή το ελάττωμα **δεν υπήρξε ποτέ** — και
 * θα ήταν σχόλιο μεταμφιεσμένο σε άγκυρα (CHECK 3.54: *«μπορεί αυτό το αρχείο να
 * κοκκινίσει κάτι;»*). Ο παρονομαστής πρώτα, η θεραπεία μετά.
 *
 * ⚠️ **ΤΟ `Κ3` ΕΙΝΑΙ ΑΥΤΟ ΠΟΥ ΜΑΣ ΑΦΟΡΑ.** Τα `Κ1`/`Κ2` περιγράφουν τη
 * **βιβλιοθήκη**· μόνο το `Κ3` ρωτά αν το **δικό μας** `config.ts` ζητά την
 * ακύρωση. Χωρίς αυτό, κάποιος μπορεί να ξαναγράψει `.use(ICU)` και τα δύο πρώτα
 * να μείνουν πράσινα — «καλυμμένο σε νεκρό δίδυμο δεν είναι καλυμμένο».
 *
 * @see docs/centralized-systems/reference/adrs/ADR-830-icu-cache-invalidation.md
 * =============================================================================
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import i18next, { type i18n as I18nInstance } from 'i18next';
import ICU from 'i18next-icu';

const NS = 'lazy-ns';
const KEY = 'title';
const EL_TEXT = 'Εισερχόμενα αιτήματα ανάθεσης';
const EN_TEXT = 'Incoming mandate requests';

/** Η μία υπογραφή του ελαττώματος: τα bindings που η βιβλιοθήκη αφήνει κενά. */
const CACHE_INVALIDATION = {
  bindI18n: 'languageChanged',
  bindI18nStore: 'added removed',
} as const;

/** Αφαιρεί σχόλια μπλοκ και γραμμής, ώστε ο έλεγχος να βλέπει **μόνο κώδικα**. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n'"`]*\/\/.*$/gm, '');
}

/**
 * Στήνει i18next **ακριβώς όπως η εφαρμογή**: `fallbackLng: 'el'`, το ελληνικό
 * bundle παρόν από την αρχή, το αγγλικό **απόν** — γιατί φορτώνεται lazy.
 */
async function bootstrap(icu: ICU): Promise<I18nInstance> {
  const instance = i18next.createInstance();
  await instance.use(icu).init({
    lng: 'el',
    fallbackLng: 'el',
    ns: [NS],
    defaultNS: NS,
    resources: { el: { [NS]: { [KEY]: EL_TEXT } } },
    interpolation: { escapeValue: false },
  });
  return instance;
}

/**
 * Το **ΠΡΑΓΜΑΤΙΚΟ** σενάριο, στη σειρά που συμβαίνει ζωντανά:
 *
 * 1. αλλαγή γλώσσας σε `en` **πριν** φτάσει το bundle → το `t()` επιστρέφει το
 *    ελληνικό μέσω fallback, και το ICU το κρατά κάτω από `en.…`·
 * 2. το lazy bundle προσγειώνεται (`addResourceBundle`)·
 * 3. ξαναρωτάμε. Ένα υγιές σύστημα απαντά **αγγλικά**.
 */
async function runLanguageSwitch(instance: I18nInstance): Promise<{
  duringFallback: string;
  afterBundleArrives: string;
}> {
  await instance.changeLanguage('en');
  const duringFallback = instance.t(KEY);

  instance.addResourceBundle('en', NS, { [KEY]: EN_TEXT }, true, true);

  return { duringFallback, afterBundleArrives: instance.t(KEY) };
}

describe('ADR-830 — ακύρωση του ICU memoization cache', () => {
  it('Κ1 (ΠΑΡΟΝΟΜΑΣΤΗΣ) — με σκέτο `.use(ICU)` το ελληνικό ΚΛΕΙΔΩΝΕΙ στο `en`', async () => {
    const instance = await bootstrap(new ICU());

    const { duringFallback, afterBundleArrives } = await runLanguageSwitch(instance);

    // Το fallback καρέ είναι **αναμενόμενο** — δεν είναι αυτό το ελάττωμα.
    expect(duringFallback).toBe(EL_TEXT);

    // 🔴 ΑΥΤΟ είναι το ελάττωμα: το σωστό κείμενο έφτασε και κανείς δεν το είδε.
    expect(instance.store.getResource('en', NS, KEY)).toBe(EN_TEXT);
    expect(afterBundleArrives).toBe(EL_TEXT);
  });

  it('Κ2 (ΘΕΡΑΠΕΙΑ) — με τα bindings, το `t()` δείχνει το κείμενο που έφτασε', async () => {
    const instance = await bootstrap(new ICU(CACHE_INVALIDATION));

    const { duringFallback, afterBundleArrives } = await runLanguageSwitch(instance);

    expect(duringFallback).toBe(EL_TEXT);
    expect(afterBundleArrives).toBe(EN_TEXT);
  });

  it('Κ2β — η ελληνική διαδρομή ΔΕΝ θυσιάζεται για να διορθωθεί η αγγλική', async () => {
    const instance = await bootstrap(new ICU(CACHE_INVALIDATION));

    expect(instance.t(KEY)).toBe(EL_TEXT);
    await runLanguageSwitch(instance);
    await instance.changeLanguage('el');

    expect(instance.t(KEY)).toBe(EL_TEXT);
  });

  it('Κ2γ — το `added` πιάνει την ΚΛΑΣΗ: κείμενο που φτάνει ΧΩΡΙΣ αλλαγή γλώσσας', async () => {
    // Route slice / lazy load / HMR: η γλώσσα δεν αλλάζει ποτέ, μόνο ο store.
    // Ένα `bindI18n: 'languageChanged'` μόνο του θα άφηνε ΑΥΤΟ το σενάριο σπασμένο.
    const instance = await bootstrap(new ICU(CACHE_INVALIDATION));

    expect(instance.t(KEY)).toBe(EL_TEXT);
    instance.addResourceBundle('el', NS, { [KEY]: 'Διορθωμένος τίτλος' }, true, true);

    expect(instance.t(KEY)).toBe('Διορθωμένος τίτλος');
  });

  it('Κ3 — το ΠΑΡΑΓΩΓΙΚΟ `config.ts` ζητά ΚΑΙ ΤΑ ΔΥΟ bindings', () => {
    // ⚠️ **ΤΑ ΣΧΟΛΙΑ ΦΕΥΓΟΥΝ ΠΡΩΤΑ, ΚΑΙ ΤΟ ΕΜΑΘΑ ΑΚΡΙΒΑ**: η πρώτη γραφή αυτού του
    // test κοκκίνιζε επειδή το ίδιο το πληρωμένο σχόλιο του `config.ts` **αναφέρει**
    // τη γραφή `.use(ICU)` για να την απαγορεύσει. Ένας έλεγχος που δεν ξεχωρίζει
    // κώδικα από πρόζα τιμωρεί την τεκμηρίωση — και η επόμενη «διόρθωση» θα ήταν να
    // σβηστεί το σχόλιο. Η ερώτηση αφορά **τι εκτελείται**.
    const source = stripComments(readFileSync(join(__dirname, '..', 'config.ts'), 'utf8'));

    // ⚠️ Ο έλεγχος είναι στο **αρχείο** και όχι σε import, επειδή το `config.ts`
    // έχει side effects εμβέλειας module (bootstrap, preload, μπαλωματής του `t`)
    // που δεν σηκώνονται σε αυτό το περιβάλλον. Το ερώτημα είναι δηλωτικό —
    // «ζητήθηκε η ακύρωση;» — και απαντιέται από την πηγή.
    const icuConstruction = /\.use\(\s*new ICU\(\{([\s\S]*?)\}\s*,?\s*\)\s*,?\s*\)/.exec(source);

    expect(icuConstruction).not.toBeNull();

    const options = icuConstruction?.[1] ?? '';
    expect(options).toContain(`bindI18n: '${CACHE_INVALIDATION.bindI18n}'`);
    expect(options).toContain(`bindI18nStore: '${CACHE_INVALIDATION.bindI18nStore}'`);

    // Ένα σκέτο `.use(ICU)` είναι ΑΚΡΙΒΩΣ η γραφή που παρήγαγε το περιστατικό.
    expect(source).not.toMatch(/\.use\(\s*ICU\s*\)/);
  });
});
